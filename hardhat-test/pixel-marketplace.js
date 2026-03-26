const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const MARKET_FEE_BPS = 250;
const STABILIZATION_SPREAD_BPS = 2000;
const LAUNCH_PROTECTION = 6 * 60 * 60;

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

function addBps(value, bps) {
  return value.add(value.mul(bps).div(BPS));
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
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
  it("supports user listings, market snapshots, and fee routing", async function () {
    const { user, buyer, nft, pool, router, market, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();
    await (await nft.connect(user).approve(market.address, 0)).wait();

    const listingPrice = ethers.utils.parseEther("0.015");
    await (await market.connect(user).createListing(0, listingPrice)).wait();

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
    const { owner, creator, user, buyer, nft, pool, router, market, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(3), { value: mintPrice })).wait();
    await (await router.connect(buyer)["mint(bytes)"](onePixel(4), { value: mintPrice })).wait();
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("6"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");

    const userListingPrice = addBps(await pool.getFloorPrice(), STABILIZATION_SPREAD_BPS);
    await (await nft.connect(buyer).approve(market.address, 1)).wait();
    await (await market.connect(buyer).createListing(1, userListingPrice)).wait();
    await (await market.connect(creator).buyListing(1, { value: userListingPrice })).wait();

    assert.strictEqual(Number(await pool.marketState()), 1);

    await (await pool.connect(owner).releasePoolInventoryForListing(1)).wait();
    const protocolListing = await market.listings(2);
    assert.strictEqual(protocolListing.protocolOwned, true);
    assert.strictEqual(protocolListing.fromPoolInventory, true);
    assert.strictEqual(await nft.ownerOf(0), market.address);

    const ethBalanceBefore = await pool.ethBalance();
    await (await market.connect(user).buyListing(2, { value: protocolListing.price })).wait();

    assert.strictEqual(await nft.ownerOf(0), user.address);
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "0");
    assert.strictEqual(await pool.pendingExternalSale(0), false);
    assert.ok((await pool.ethBalance()).gt(ethBalanceBefore));
  });
});
