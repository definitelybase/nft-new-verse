const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const INVENTORY_STALE_AGE = 7 * 24 * 60 * 60;
const MARKET_STATE_SLOT = 24;
const STABILIZATION_SPREAD_BPS = 2000;

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

async function deployStack() {
  const [owner, creator, user, buyer] = await ethers.getSigners();
  const mintPrice = ethers.utils.parseEther("0.01");

  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy(
    "OnChainPixels",
    "OCPX",
    4,
    1,
    1,
    1000,
    mintPrice,
    palette16()
  );
  await nft.deployed();

  const Pool = await ethers.getContractFactory("PixelPool");
  const pool = await Pool.deploy(nft.address, mintPrice);
  await pool.deployed();

  const Router = await ethers.getContractFactory("PixelRouter");
  const router = await Router.deploy(
    nft.address,
    pool.address,
    creator.address,
    mintPrice,
    POOL_SEED_BPS,
    TREASURY_BPS
  );
  await router.deployed();

  const Market = await ethers.getContractFactory("PixelMarketplace");
  const market = await Market.deploy(nft.address, pool.address, 250);
  await market.deployed();

  await (await nft.connect(owner).setMinter(router.address, true)).wait();
  await (await nft.connect(owner).setBurner(pool.address, true)).wait();
  await (await pool.connect(owner).setRouter(router.address)).wait();
  await (await pool.connect(owner).setListingVault(market.address)).wait();

  return { owner, creator, user, buyer, nft, pool, router, market, mintPrice };
}

async function withTemporaryRouter(pool, owner, tempRouter, fn) {
  const originalRouter = await pool.router();
  await (await pool.connect(owner).setRouter(tempRouter.address)).wait();
  try {
    await fn();
  } finally {
    await (await pool.connect(owner).setRouter(originalRouter)).wait();
  }
}

async function seedReserves(pool, owner, liquidityAmount, treasuryAmount) {
  await withTemporaryRouter(pool, owner, owner, async () => {
    if (liquidityAmount && !liquidityAmount.isZero()) {
      await (await pool.connect(owner).seedLiquidity({ value: liquidityAmount })).wait();
    }
    if (treasuryAmount && !treasuryAmount.isZero()) {
      await (await pool.connect(owner).seedTreasury({ value: treasuryAmount })).wait();
    }
  });
}

async function mintAndSellOne(router, nft, user, mintPrice) {
  await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();
  await (await nft.connect(user).approve(router.address, 0)).wait();
  await (await router.connect(user).sellNFT(0, 0)).wait();
}

function slotCacheKey(contract, getterName) {
  return `${contract.address}:${getterName}`;
}

async function findStorageSlot(contract, getterName, probeValue) {
  const key = slotCacheKey(contract, getterName);
  if (slotCache[key] !== undefined) {
    return slotCache[key];
  }

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

async function forceMarketState(pool, value) {
  await ethers.provider.send("hardhat_setStorageAt", [
    pool.address,
    slotHex(MARKET_STATE_SLOT),
    valueHex(value)
  ]);
  await ethers.provider.send("evm_mine", []);
}

async function setMarketSnapshot(pool, owner, sales24h, activeListings, externalFloor) {
  await (await pool.connect(owner).setExternalMarketSnapshot(sales24h, activeListings, externalFloor)).wait();
}

describe("PixelPool market-state thresholds and negative gates", function () {
  it("keeps pool selling disabled during launch protection even with healthy reserve and forced stabilization", async function () {
    const { pool } = await deployStack();

    await forceMarketState(pool, 1);
    await setUintVar(pool, "ethBalance", ethers.utils.parseEther("10"));

    assert.strictEqual(await pool.canSellIntoPool(), false);
  });

  it("requires coverage >= 10000 before selling into the pool after launch", async function () {
    const { pool } = await deployStack();

    await increaseTime(LAUNCH_PROTECTION + 1);
    await forceMarketState(pool, 1);

    await setUintVar(pool, "ethBalance", ethers.utils.parseEther("2"));
    assert.strictEqual(await pool.canSellIntoPool(), false);

    await setUintVar(pool, "ethBalance", ethers.utils.parseEther("3"));
    assert.strictEqual(await pool.canSellIntoPool(), true);
  });

  it("allows external listing only when stabilization, listing vault, and inventory are all present", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await seedReserves(pool, owner, ethers.utils.parseEther("6"), ethers.constants.Zero);
    await increaseTime(LAUNCH_PROTECTION + 1);

    await forceMarketState(pool, 1);
    assert.strictEqual(await pool.canReleaseInventoryForListing(), false);

    await mintAndSellOne(router, nft, user, mintPrice);

    await forceMarketState(pool, 2);
    assert.strictEqual(await pool.canReleaseInventoryForListing(), false);

    const floor = await pool.getFloorPrice();
    await setMarketSnapshot(pool, owner, 2, 120, addBps(floor, STABILIZATION_SPREAD_BPS));
    assert.strictEqual(await pool.canReleaseInventoryForListing(), true);
  });

  it("keeps the market in stabilization when only one weak signal is present", async function () {
    const { owner, pool } = await deployStack();
    const floor = await pool.getFloorPrice();

    await increaseTime(LAUNCH_PROTECTION + 1);
    await setMarketSnapshot(pool, owner, 0, 120, addBps(floor, STABILIZATION_SPREAD_BPS));

    assert.strictEqual((await pool.marketState()).toString(), "1");
  });

  it("keeps buyback disabled at exact weak-market boundary values", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await seedReserves(pool, owner, ethers.utils.parseEther("6"), ethers.utils.parseEther("1"));
    await increaseTime(LAUNCH_PROTECTION + 1);
    await mintAndSellOne(router, nft, user, mintPrice);

    await forceMarketState(pool, 2);
    const floor = await pool.getFloorPrice();
    await setMarketSnapshot(pool, owner, 1, 150, floor);

    const [mode] = await pool.getBuybackMode();
    assert.strictEqual(mode.toString(), "0");
  });

  it("enables buyback once weak-market signals move past the thresholds", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await seedReserves(pool, owner, ethers.utils.parseEther("6"), ethers.utils.parseEther("1"));
    await increaseTime(LAUNCH_PROTECTION + 1);
    await mintAndSellOne(router, nft, user, mintPrice);

    const floor = await pool.getFloorPrice();
    await setMarketSnapshot(pool, owner, 0, 151, floor.sub(1));

    const [mode, maxBuy] = await pool.getBuybackMode();
    assert.strictEqual(mode.toString(), "1");
    assert.strictEqual(maxBuy.toString(), "1");
  });

  it("keeps buyback disabled below the 20000 coverage threshold even for stale inventory", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await seedReserves(pool, owner, ethers.utils.parseEther("6"), ethers.utils.parseEther("1"));
    await increaseTime(LAUNCH_PROTECTION + 1);
    await mintAndSellOne(router, nft, user, mintPrice);
    await increaseTime(INVENTORY_STALE_AGE + 1);

    await setUintVar(pool, "ethBalance", ethers.utils.parseEther("5"));
    let [mode] = await pool.getBuybackMode();
    assert.strictEqual(mode.toString(), "0");

    await setUintVar(pool, "ethBalance", ethers.utils.parseEther("6"));
    [mode] = await pool.getBuybackMode();
    assert.strictEqual(mode.toString(), "1");
  });
});
