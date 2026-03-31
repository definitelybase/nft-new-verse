const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const MARKET_FEE_BPS = 250;
const STABILIZATION_SPREAD_BPS = 2000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const slotCache = {};

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

function slotHex(slot) {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(slot), 32);
}

function valueHex(value) {
  return ethers.utils.hexZeroPad(ethers.BigNumber.from(value).toHexString(), 32);
}

function addBps(value, bps) {
  return value.add(value.mul(bps).div(BPS));
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

function slotCacheKey(contract, getterName) {
  return `${contract.address}:${getterName}`;
}

async function findStorageSlot(contract, getterName, probeValue) {
  const key = slotCacheKey(contract, getterName);
  if (slotCache[key] !== undefined) return slotCache[key];

  for (let candidate = 0; candidate < 80; candidate++) {
    const slot = slotHex(candidate);
    const original = await ethers.provider.getStorageAt(contract.address, slot);

    await ethers.provider.send("hardhat_setStorageAt", [contract.address, slot, valueHex(probeValue)]);
    await ethers.provider.send("evm_mine", []);

    const current = await contract[getterName]();
    const matches = ethers.BigNumber.isBigNumber(current)
      ? current.eq(probeValue)
      : Number(current) === Number(probeValue);

    await ethers.provider.send("hardhat_setStorageAt", [contract.address, slot, original]);
    await ethers.provider.send("evm_mine", []);

    if (matches) {
      slotCache[key] = candidate;
      return candidate;
    }
  }

  throw new Error(`Unable to locate storage slot for ${getterName}`);
}

async function setUintVar(contract, getterName, value, probeValue = 987654321) {
  const slot = await findStorageSlot(contract, getterName, probeValue);
  await ethers.provider.send("hardhat_setStorageAt", [
    contract.address,
    slotHex(slot),
    valueHex(value)
  ]);
  await ethers.provider.send("evm_mine", []);
}

async function expectCustomError(promise, errorName) {
  await assert.rejects(promise, new RegExp(errorName));
}

async function deployStack() {
  const [owner, creator, user, buyer, other] = await ethers.getSigners();
  const mintPrice = ethers.utils.parseEther("0.01");

  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy("OnChainPixels", "OCPX", 4, 1, 1, 1000, mintPrice, palette16());
  await nft.deployed();

  const Pool = await ethers.getContractFactory("PixelPool");
  const pool = await Pool.deploy(nft.address, mintPrice);
  await pool.deployed();

  const Router = await ethers.getContractFactory("PixelRouter");
  const router = await Router.deploy(nft.address, pool.address, creator.address, mintPrice, POOL_SEED_BPS, TREASURY_BPS);
  await router.deployed();

  const Market = await ethers.getContractFactory("PixelMarketplace");
  const market = await Market.deploy(nft.address, pool.address, MARKET_FEE_BPS);
  await market.deployed();

  await (await nft.setMinter(router.address, true)).wait();
  await (await nft.setBurner(pool.address, true)).wait();
  await (await pool.setRouter(router.address)).wait();
  await (await pool.setListingVault(market.address)).wait();

  return { owner, creator, user, buyer, other, nft, pool, router, market, mintPrice };
}

async function seedPoolReserve(pool, owner, routerAddress, amount) {
  await (await pool.connect(owner).setRouter(owner.address)).wait();
  await (await pool.connect(owner).seedLiquidity({ value: amount })).wait();
  await (await pool.connect(owner).setRouter(routerAddress)).wait();
}

describe("PixelMarketplace", function () {
  it("lets owner pause trading while still allowing listing cancellation", async function () {
    const { owner, creator, user, buyer, other, nft, pool, router, market, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();
    await (await nft.connect(user).approve(market.address, 0)).wait();

    const listingPrice = ethers.utils.parseEther("0.015");
    await (await market.connect(user).createListing(0, listingPrice)).wait();

    await (await market.connect(owner).pause()).wait();

    await assert.rejects(
      market.connect(user).updateListingPrice(1, listingPrice.add(1)),
      /paused/
    );
    await assert.rejects(
      market.connect(buyer).buyListing(1, { value: listingPrice }),
      /paused/
    );
    await assert.rejects(
      market.connect(other).createListing(999, listingPrice),
      /paused/
    );

    await (await market.connect(user).cancelListing(1)).wait();
    assert.strictEqual(await nft.ownerOf(0), user.address);

    await (await router.connect(user)["mint(bytes)"](onePixel(3), { value: mintPrice })).wait();
    await (await router.connect(buyer)["mint(bytes)"](onePixel(4), { value: mintPrice })).wait();
    await (await router.connect(other)["mint(bytes)"](onePixel(5), { value: mintPrice })).wait();
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("6"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    await (await nft.connect(user).approve(router.address, 1)).wait();
    await (await router.connect(user).sellNFT(1, 0)).wait();

    const userListingPrice = addBps(await pool.getFloorPrice(), STABILIZATION_SPREAD_BPS);
    await (await nft.connect(buyer).approve(market.address, 2)).wait();
    await (await nft.connect(other).approve(market.address, 3)).wait();
    await (await market.connect(owner).unpause()).wait();
    await (await market.connect(buyer).createListing(2, userListingPrice)).wait();
    await (await market.connect(other).createListing(3, userListingPrice)).wait();
    await (await market.connect(creator).buyListing(2, { value: userListingPrice })).wait();
    await (await market.connect(creator).buyListing(3, { value: userListingPrice })).wait();

    await (await market.connect(owner).pause()).wait();
    await assert.rejects(
      pool.connect(owner).releasePoolInventoryForListing(1),
      /paused/
    );
  });

  it("supports user listings, market snapshots, and fee routing", async function () {
    const { user, buyer, nft, pool, router, market, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();
    await (await nft.connect(user).approve(market.address, 0)).wait();

    const listingPrice = ethers.utils.parseEther("0.015");
    await (await market.connect(user).createListing(0, listingPrice, 0)).wait();

    let snapshot = await market.getMarketSnapshot();
    assert.strictEqual(snapshot.listedCount.toString(), "1");
    assert.strictEqual(snapshot.floorPrice.toString(), listingPrice.toString());

    const protocolFeesBefore = await pool.protocolFees();
    await (await market.connect(buyer).buyListing(1, { value: listingPrice })).wait();

    snapshot = await market.getMarketSnapshot();
    assert.strictEqual(snapshot.sales24h.toString(), "1");
    assert.strictEqual(snapshot.listedCount.toString(), "0");
    assert.strictEqual(await nft.ownerOf(0), buyer.address);
    assert.ok((await pool.protocolFees()).gt(protocolFeesBefore));
  });

  it("auto-lists protocol inventory in the native market and settles sale back into the pool", async function () {
    const { owner, creator, user, buyer, other, nft, pool, router, market, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(3), { value: mintPrice })).wait();
    await (await router.connect(buyer)["mint(bytes)"](onePixel(4), { value: mintPrice })).wait();
    await (await router.connect(other)["mint(bytes)"](onePixel(5), { value: mintPrice })).wait();
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("6"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");

    const userListingPrice = addBps(await pool.getFloorPrice(), STABILIZATION_SPREAD_BPS);
    await (await nft.connect(buyer).approve(market.address, 1)).wait();
    await (await nft.connect(other).approve(market.address, 2)).wait();
    await (await market.connect(buyer).createListing(1, userListingPrice, 0)).wait();
    await (await market.connect(other).createListing(2, userListingPrice, 0)).wait();
    await (await market.connect(creator).buyListing(1, { value: userListingPrice })).wait();
    await setUintVar(pool, "totalMinted", 10);
    assert.strictEqual(await pool.canReleaseInventoryForListing(), true);

    await (await pool.connect(owner).releasePoolInventoryForListing(1)).wait();
    const protocolListing = await market.listings(3);
    assert.strictEqual(protocolListing.protocolOwned, true);
    assert.strictEqual(protocolListing.fromPoolInventory, true);
    assert.strictEqual(await nft.ownerOf(0), market.address);

    const ethBalanceBefore = await pool.ethBalance();
    await (await market.connect(user).buyListing(3, { value: protocolListing.price })).wait();

    assert.strictEqual(await nft.ownerOf(0), user.address);
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "0");
    assert.strictEqual(await pool.pendingExternalSale(0), false);
    assert.ok((await pool.ethBalance()).gt(ethBalanceBefore));
  });

  it("blocks reentrancy through onERC721Received and keeps the second listing active", async function () {
    const { owner, user, buyer, nft, router, market, mintPrice } = await deployStack();

    const ReenteringBuyer = await ethers.getContractFactory("MarketplaceReenteringBuyer");
    const attacker = await ReenteringBuyer.deploy(market.address);
    await attacker.deployed();

    await (await router.connect(user)["mint(bytes)"](onePixel(5), { value: mintPrice })).wait();
    await (await router.connect(user)["mint(bytes)"](onePixel(6), { value: mintPrice })).wait();
    await (await nft.connect(user).setApprovalForAll(market.address, true)).wait();

    const listingPriceOne = ethers.utils.parseEther("0.012");
    const listingPriceTwo = ethers.utils.parseEther("0.013");

    await (await market.connect(user).createListing(0, listingPriceOne, 0)).wait();
    await (await market.connect(user).createListing(1, listingPriceTwo, 0)).wait();

    await owner.sendTransaction({ to: attacker.address, value: listingPriceTwo });
    await (await attacker.attackBuy(1, 2, listingPriceTwo, { value: listingPriceOne })).wait();

    assert.strictEqual(await nft.ownerOf(0), attacker.address);
    assert.strictEqual(await nft.ownerOf(1), market.address);
    assert.strictEqual(await attacker.attemptedReentry(), true);
    assert.strictEqual(await attacker.failedReentry(), true);

    const secondListing = await market.listings(2);
    assert.strictEqual(secondListing.active, true);
    assert.strictEqual(secondListing.tokenId.toString(), "1");
  });

  it("rejects direct safe transfers into the marketplace outside the protocol flow", async function () {
    const { user, nft, router, market, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(7), { value: mintPrice })).wait();

    await expectCustomError(
      nft.connect(user)["safeTransferFrom(address,address,uint256)"](user.address, market.address, 0),
      "UnknownProtocolTransfer"
    );
  });

  it("does not allow the same listing to be bought twice and prunes old sales from the 24h window", async function () {
    const { user, buyer, other, nft, router, market, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(8), { value: mintPrice })).wait();
    await (await router.connect(user)["mint(bytes)"](onePixel(9), { value: mintPrice })).wait();
    await (await nft.connect(user).setApprovalForAll(market.address, true)).wait();

    const firstPrice = ethers.utils.parseEther("0.014");
    const secondPrice = ethers.utils.parseEther("0.016");

    await (await market.connect(user).createListing(0, firstPrice, 0)).wait();
    await (await market.connect(user).createListing(1, secondPrice, 0)).wait();

    await (await market.connect(buyer).buyListing(1, { value: firstPrice })).wait();
    await expectCustomError(
      market.connect(other).buyListing(1, { value: firstPrice }),
      "ListingNotActive"
    );

    let snapshot = await market.getMarketSnapshot();
    assert.strictEqual(snapshot.sales24h.toString(), "1");
    assert.strictEqual(snapshot.listedCount.toString(), "1");

    await increaseTime((24 * 60 * 60) + 1);
    snapshot = await market.getMarketSnapshot();
    assert.strictEqual(snapshot.sales24h.toString(), "0");

    await (await market.connect(other).buyListing(2, { value: secondPrice })).wait();
    snapshot = await market.getMarketSnapshot();
    assert.strictEqual(snapshot.sales24h.toString(), "1");
    assert.strictEqual(snapshot.listedCount.toString(), "0");
  });
});
