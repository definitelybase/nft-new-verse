const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const TRADE_FEE_BPS = 250;
const STABILIZATION_SPREAD_BPS = 2000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const LONG_WINDOW = 24 * 60 * 60;
const INVENTORY_STALE_AGE = 7 * 24 * 60 * 60;

let marketStateSlot;
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

  await (await nft.connect(owner).setMinter(router.address, true)).wait();
  await (await nft.connect(owner).setBurner(pool.address, true)).wait();
  await (await pool.connect(owner).setRouter(router.address)).wait();

  return { owner, creator, user, buyer, nft, pool, router, mintPrice };
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

async function mintMany(router, user, mintPrice, tokenCount) {
  for (let i = 0; i < tokenCount; i++) {
    await (await router.connect(user)["mint(bytes)"](onePixel((i % 15) + 1), { value: mintPrice })).wait();
  }
}

async function sellMany(router, nft, user, tokenIds) {
  await (await nft.connect(user).setApprovalForAll(router.address, true)).wait();
  for (const tokenId of tokenIds) {
    await (await router.connect(user).sellNFT(tokenId, 0)).wait();
  }
}

async function locateMarketStateSlot(pool) {
  if (marketStateSlot !== undefined) {
    return marketStateSlot;
  }

  for (let candidate = 0; candidate < 50; candidate++) {
    const slot = slotHex(candidate);
    const original = await ethers.provider.getStorageAt(pool.address, slot);

    await ethers.provider.send("hardhat_setStorageAt", [pool.address, slot, valueHex(1)]);
    await ethers.provider.send("evm_mine", []);

    if (Number(await pool.marketState()) === 1) {
      marketStateSlot = candidate;
      await ethers.provider.send("hardhat_setStorageAt", [pool.address, slot, original]);
      await ethers.provider.send("evm_mine", []);
      return marketStateSlot;
    }

    await ethers.provider.send("hardhat_setStorageAt", [pool.address, slot, original]);
    await ethers.provider.send("evm_mine", []);
  }

  throw new Error("Unable to locate marketState storage slot");
}

async function forceMarketState(pool, desiredState) {
  const slot = await locateMarketStateSlot(pool);
  await ethers.provider.send("hardhat_setStorageAt", [
    pool.address,
    slotHex(slot),
    valueHex(desiredState)
  ]);
  await ethers.provider.send("evm_mine", []);
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

async function forceStabilizationMetrics(pool) {
  const floor = await pool.getFloorPrice();
  await setUintVar(pool, "shortWindowVolume", 1);
  await setUintVar(pool, "longWindowVolume", 4);
  await setUintVar(pool, "shortWindowBuys", 1);
  await setUintVar(pool, "shortWindowSells", 1);
  await setUintVar(pool, "floorEma", floor);
}

describe("PixelPool longer scenarios", function () {
  it("tracks net sell pressure across multiple sells and buys", async function () {
    const { owner, user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await mintMany(router, user, mintPrice, 3);
    await seedReserves(pool, owner, ethers.utils.parseEther("10"), ethers.constants.Zero);

    const floorStart = await pool.getFloorPrice();

    await increaseTime(LAUNCH_PROTECTION + 1);
    await sellMany(router, nft, user, [0, 1, 2]);

    const floorAfterSells = await pool.getFloorPrice();
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "3");
    assert.strictEqual((await pool.availableNFTs()).toString(), "3");
    assert(floorAfterSells.lt(floorStart));

    await increaseTime(LONG_WINDOW + 1);
    await forceStabilizationMetrics(pool);

    const price1 = addBps(addBps(await pool.getFloorPrice(), STABILIZATION_SPREAD_BPS), TRADE_FEE_BPS);
    await (await router.connect(buyer).buySpecificNFT(0, price1, { value: price1 })).wait();

    await forceStabilizationMetrics(pool);
    const price2 = addBps(addBps(await pool.getFloorPrice(), STABILIZATION_SPREAD_BPS), TRADE_FEE_BPS);
    await (await router.connect(buyer).buySpecificNFT(1, price2, { value: price2 })).wait();

    const floorAfterBuys = await pool.getFloorPrice();
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");
    assert.strictEqual((await pool.availableNFTs()).toString(), "1");
    assert(floorAfterBuys.gt(floorAfterSells));
  });

  it("moves floorEma down after sells and back up after buys", async function () {
    const { owner, user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(4), { value: mintPrice })).wait();
    await seedReserves(pool, owner, ethers.utils.parseEther("6"), ethers.constants.Zero);

    const emaStart = await pool.floorEma();

    await increaseTime(LAUNCH_PROTECTION + 1);
    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();

    const emaAfterSell = await pool.floorEma();
    assert(emaAfterSell.lt(emaStart));

    await increaseTime(LONG_WINDOW + 1);

    const buyCost = addBps(addBps(await pool.getFloorPrice(), STABILIZATION_SPREAD_BPS), TRADE_FEE_BPS);
    await (await router.connect(buyer).buySpecificNFT(0, buyCost, { value: buyCost })).wait();

    const emaAfterBuy = await pool.floorEma();
    assert(emaAfterBuy.gt(emaAfterSell));
  });

  it("stops buyback once treasury budget can no longer fund one floor purchase even if inventory remains", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintMany(router, user, mintPrice, 2);
    await seedReserves(
      pool,
      owner,
      ethers.utils.parseEther("6"),
      ethers.utils.parseEther("0.118")
    );

    await increaseTime(LAUNCH_PROTECTION + 1);
    await sellMany(router, nft, user, [0, 1]);
    await increaseTime(INVENTORY_STALE_AGE + 1);

    let [mode, maxBuy] = await pool.getBuybackMode();
    assert.strictEqual(mode.toString(), "1");
    assert.strictEqual(maxBuy.toString(), "1");

    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.availableNFTs()).toString(), "1");
    assert.strictEqual((await pool.vaultSize()).toString(), "1");

    [mode, maxBuy] = await pool.getBuybackMode();
    assert.strictEqual(mode.toString(), "0");
    assert.strictEqual(maxBuy.toString(), "0");
  });

  it("buySpecific remains blocked in WeakDemand even when inventory exists", async function () {
    const { owner, user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(5), { value: mintPrice })).wait();
    await seedReserves(pool, owner, ethers.utils.parseEther("6"), ethers.constants.Zero);

    await increaseTime(LAUNCH_PROTECTION + 1);
    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();

    await forceMarketState(pool, 2);
    assert.strictEqual(Number(await pool.marketState()), 2);
    assert.strictEqual(await pool.canBuyFromPool(), false);

    const attemptedCost = addBps(addBps(await pool.getFloorPrice(), STABILIZATION_SPREAD_BPS), TRADE_FEE_BPS);
    await assert.rejects(
      router.connect(buyer).buySpecificNFT(0, attemptedCost, { value: attemptedCost }),
      /PoolBuyDisabled/
    );
  });
});
