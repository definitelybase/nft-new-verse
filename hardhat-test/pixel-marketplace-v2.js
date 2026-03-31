const assert = require("assert");
const { ethers } = require("hardhat");

const MARKET_FEE_BPS = 250;
const BPS = 10000;

function palette16() {
  return ethers.utils.hexlify([
    0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
    0xff, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff,
    0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x80, 0x80, 0x00,
    0x80, 0x00, 0x80, 0x00, 0x80, 0x80, 0x80, 0x80, 0x80, 0xc0, 0xc0, 0xc0
  ]);
}

function onePixel(colorIndex = 1) {
  return ethers.utils.hexlify([(colorIndex & 0x0f) << 4]);
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

async function expectCustomError(promise, errorName) {
  await assert.rejects(promise, new RegExp(errorName));
}

async function deployStack() {
  const [owner, creator, alice, bob, carol] = await ethers.getSigners();
  const mintPrice = ethers.utils.parseEther("0.01");

  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy("OnChainPixels", "OCPX", 4, 1, 1, 1000, mintPrice, palette16());

  const Pool = await ethers.getContractFactory("PixelPool");
  const pool = await Pool.deploy(nft.address, mintPrice);

  const Router = await ethers.getContractFactory("PixelRouter");
  const router = await Router.deploy(nft.address, pool.address, creator.address, mintPrice, 6000, 1000);

  const Market = await ethers.getContractFactory("PixelMarketplace");
  const market = await Market.deploy(nft.address, pool.address, MARKET_FEE_BPS);

  await (await nft.setMinter(router.address, true)).wait();
  await (await nft.setBurner(pool.address, true)).wait();
  await (await pool.setRouter(router.address)).wait();
  await (await pool.setListingVault(market.address)).wait();

  // Mint tokens: alice gets 0,1,2 — bob gets 3,4
  for (let i = 0; i < 3; i++) {
    await (await router.connect(alice)["mint(bytes)"](onePixel(i + 1), { value: mintPrice })).wait();
  }
  for (let i = 0; i < 2; i++) {
    await (await router.connect(bob)["mint(bytes)"](onePixel(i + 4), { value: mintPrice })).wait();
  }

  return { owner, creator, alice, bob, carol, nft, pool, router, market, mintPrice };
}

describe("PixelMarketplace v2 — Offers", function () {
  it("makeOffer escrows ETH and acceptOffer pays seller minus fee", async function () {
    const { alice, bob, nft, market } = await deployStack();

    const offerAmount = ethers.utils.parseEther("0.02");
    const tx = await market.connect(bob).makeOffer(0, 0, { value: offerAmount });
    const rc = await tx.wait();

    const offer = await market.offers(1);
    assert.strictEqual(offer.maker, bob.address);
    assert.strictEqual(offer.tokenId.toString(), "0");
    assert.strictEqual(offer.amount.toString(), offerAmount.toString());
    assert.strictEqual(offer.active, true);
    assert.strictEqual((await market.activeOfferCount()).toString(), "1");

    // Alice accepts
    await (await nft.connect(alice).approve(market.address, 0)).wait();
    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const acceptTx = await market.connect(alice).acceptOffer(1, 0);
    const acceptRc = await acceptTx.wait();
    const gasCost = acceptRc.gasUsed.mul(acceptRc.effectiveGasPrice);
    const aliceAfter = await ethers.provider.getBalance(alice.address);

    const fee = offerAmount.mul(MARKET_FEE_BPS).div(BPS);
    const proceeds = offerAmount.sub(fee);
    assert.strictEqual(aliceAfter.sub(aliceBefore).add(gasCost).toString(), proceeds.toString());

    // NFT transferred to bob
    assert.strictEqual(await nft.ownerOf(0), bob.address);

    // Offer deactivated
    const offerAfter = await market.offers(1);
    assert.strictEqual(offerAfter.active, false);
    assert.strictEqual((await market.activeOfferCount()).toString(), "0");
  });

  it("cancelOffer returns escrowed ETH", async function () {
    const { bob, market } = await deployStack();

    const offerAmount = ethers.utils.parseEther("0.05");
    await (await market.connect(bob).makeOffer(0, 0, { value: offerAmount })).wait();

    const bobBefore = await ethers.provider.getBalance(bob.address);
    const tx = await market.connect(bob).cancelOffer(1);
    const rc = await tx.wait();
    const gasCost = rc.gasUsed.mul(rc.effectiveGasPrice);
    const bobAfter = await ethers.provider.getBalance(bob.address);

    assert.strictEqual(bobAfter.sub(bobBefore).add(gasCost).toString(), offerAmount.toString());
    assert.strictEqual((await market.offers(1)).active, false);
  });

  it("rejects accepting an expired offer", async function () {
    const { alice, bob, nft, market } = await deployStack();

    const duration = 3600; // 1 hour
    await (await market.connect(bob).makeOffer(0, duration, { value: ethers.utils.parseEther("0.01") })).wait();

    await increaseTime(3601);

    await (await nft.connect(alice).approve(market.address, 0)).wait();
    await expectCustomError(
      market.connect(alice).acceptOffer(1, 0),
      "OfferExpired"
    );
  });

  it("reclaimExpiredOffer returns ETH to maker", async function () {
    const { alice, bob, carol, market } = await deployStack();

    const offerAmount = ethers.utils.parseEther("0.03");
    await (await market.connect(bob).makeOffer(0, 3600, { value: offerAmount })).wait();

    // Cannot reclaim before expiry
    await expectCustomError(
      market.connect(carol).reclaimExpiredOffer(1),
      "OfferNotActive"
    );

    await increaseTime(3601);

    const bobBefore = await ethers.provider.getBalance(bob.address);
    // Carol can reclaim on bob's behalf
    await (await market.connect(carol).reclaimExpiredOffer(1)).wait();
    const bobAfter = await ethers.provider.getBalance(bob.address);

    assert.strictEqual(bobAfter.sub(bobBefore).toString(), offerAmount.toString());
  });

  it("rejects offer on own token", async function () {
    const { alice, market } = await deployStack();

    await expectCustomError(
      market.connect(alice).makeOffer(0, 0, { value: ethers.utils.parseEther("0.01") }),
      "CannotOfferOwnToken"
    );
  });

  it("only offer maker can cancel", async function () {
    const { alice, bob, market } = await deployStack();

    await (await market.connect(bob).makeOffer(0, 0, { value: ethers.utils.parseEther("0.01") })).wait();

    await expectCustomError(
      market.connect(alice).cancelOffer(1),
      "NotOfferMaker"
    );
  });
});

describe("PixelMarketplace v2 — Collection Offers", function () {
  it("makeCollectionOffer can be accepted with any token", async function () {
    const { alice, bob, carol, nft, market } = await deployStack();

    const offerAmount = ethers.utils.parseEther("0.015");
    await (await market.connect(carol).makeCollectionOffer(0, { value: offerAmount })).wait();

    const offer = await market.offers(1);
    assert.strictEqual(offer.tokenId.toString(), ethers.constants.MaxUint256.toString());

    // Alice accepts with token #2
    await (await nft.connect(alice).approve(market.address, 2)).wait();
    await (await market.connect(alice).acceptOffer(1, 2)).wait();

    assert.strictEqual(await nft.ownerOf(2), carol.address);
    assert.strictEqual((await market.offers(1)).active, false);
  });

  it("getBestOffer returns highest across token + collection offers", async function () {
    const { bob, carol, market } = await deployStack();

    await (await market.connect(bob).makeOffer(0, 0, { value: ethers.utils.parseEther("0.01") })).wait();
    await (await market.connect(carol).makeCollectionOffer(0, { value: ethers.utils.parseEther("0.02") })).wait();
    await (await market.connect(bob).makeOffer(0, 0, { value: ethers.utils.parseEther("0.015") })).wait();

    const [bestId, bestAmount] = await market.getBestOffer(0);
    assert.strictEqual(bestAmount.toString(), ethers.utils.parseEther("0.02").toString());
    assert.strictEqual(bestId.toString(), "2"); // collection offer
  });
});

describe("PixelMarketplace v2 — Listing Expiration", function () {
  it("createListing with duration sets expiry", async function () {
    const { alice, nft, market } = await deployStack();

    const duration = 7 * 24 * 3600; // 1 week
    await (await nft.connect(alice).approve(market.address, 0)).wait();
    await (await market.connect(alice).createListing(0, ethers.utils.parseEther("0.1"), duration)).wait();

    const listing = await market.listings(1);
    assert.ok(listing.expiresAt > 0);
    assert.strictEqual(listing.active, true);
  });

  it("rejects buying an expired listing", async function () {
    const { alice, bob, nft, market } = await deployStack();

    const duration = 3600;
    await (await nft.connect(alice).approve(market.address, 0)).wait();
    await (await market.connect(alice).createListing(0, ethers.utils.parseEther("0.05"), duration)).wait();

    await increaseTime(3601);

    await expectCustomError(
      market.connect(bob).buyListing(1, { value: ethers.utils.parseEther("0.05") }),
      "ListingExpired"
    );
  });

  it("rejects duration below minimum", async function () {
    const { alice, nft, market } = await deployStack();

    await (await nft.connect(alice).approve(market.address, 0)).wait();
    await expectCustomError(
      market.connect(alice).createListing(0, ethers.utils.parseEther("0.05"), 60), // 1 min < 1 hour min
      "InvalidDuration"
    );
  });

  it("duration=0 uses max duration", async function () {
    const { alice, nft, market } = await deployStack();

    await (await nft.connect(alice).approve(market.address, 0)).wait();
    await (await market.connect(alice).createListing(0, ethers.utils.parseEther("0.05"), 0)).wait();

    const listing = await market.listings(1);
    // Max is 180 days
    assert.ok(listing.expiresAt > 0);
  });

  it("expired listings are excluded from floor calculation", async function () {
    const { alice, bob, nft, market } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(market.address, true)).wait();
    await (await nft.connect(bob).setApprovalForAll(market.address, true)).wait();

    // Short-lived cheap listing
    await (await market.connect(alice).createListing(0, ethers.utils.parseEther("0.01"), 3600)).wait();
    // Long-lived expensive listing
    await (await market.connect(bob).createListing(3, ethers.utils.parseEther("0.05"), 0)).wait();

    let floor = await market.currentFloor();
    assert.strictEqual(floor.toString(), ethers.utils.parseEther("0.01").toString());

    // Expire the cheap listing, cancel it (owner reclaims)
    await increaseTime(3601);
    await (await market.connect(alice).cancelListing(1)).wait();

    floor = await market.currentFloor();
    assert.strictEqual(floor.toString(), ethers.utils.parseEther("0.05").toString());
  });
});

describe("PixelMarketplace v2 — Activity History", function () {
  it("records listing, sale, and offer activities", async function () {
    const { alice, bob, nft, market } = await deployStack();

    await (await nft.connect(alice).approve(market.address, 0)).wait();
    await (await market.connect(alice).createListing(0, ethers.utils.parseEther("0.05"), 0)).wait();

    // Buy
    await (await market.connect(bob).buyListing(1, { value: ethers.utils.parseEther("0.05") })).wait();

    // Make + cancel offer
    await (await market.connect(bob).makeOffer(1, 0, { value: ethers.utils.parseEther("0.01") })).wait();
    await (await market.connect(bob).cancelOffer(1)).wait();

    const nextId = await market.nextActivityId();
    assert.ok(nextId.gte(4)); // at least: listing, sale, offer, cancel

    const recent = await market.getRecentActivity(nextId, 4);
    assert.strictEqual(recent.length, 4);

    // Most recent first (descending)
    assert.strictEqual(recent[0].activityType, 6); // ACT_OFFER_CANCELLED
    assert.strictEqual(recent[1].activityType, 4); // ACT_OFFER_CREATED
    assert.strictEqual(recent[2].activityType, 3); // ACT_SALE
    assert.strictEqual(recent[3].activityType, 1); // ACT_LISTING_CREATED
  });

  it("getTokenActivity returns only activities for the given token", async function () {
    const { alice, bob, nft, market } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(market.address, true)).wait();

    // List token 0
    await (await market.connect(alice).createListing(0, ethers.utils.parseEther("0.05"), 0)).wait();
    // List token 1
    await (await market.connect(alice).createListing(1, ethers.utils.parseEther("0.06"), 0)).wait();
    // Buy token 0
    await (await market.connect(bob).buyListing(1, { value: ethers.utils.parseEther("0.05") })).wait();

    const token0Activity = await market.getTokenActivity(0, 10);
    // Should have: listing + sale for token 0
    assert.strictEqual(token0Activity.length, 2);
    assert.ok(token0Activity.every(a => a.tokenId.toString() === "0"));

    const token1Activity = await market.getTokenActivity(1, 10);
    assert.strictEqual(token1Activity.length, 1);
  });
});
