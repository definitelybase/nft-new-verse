const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const INVENTORY_STALE_AGE = 7 * 24 * 60 * 60;
const VAULT_BURN_AGE = 14 * 24 * 60 * 60;
const MARKET_STATE_SLOT = 24;
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

async function mintMany(router, user, mintPrice, count) {
  for (let i = 0; i < count; i++) {
    await (await router.connect(user)["mint(bytes)"](onePixel((i % 15) + 1), { value: mintPrice })).wait();
  }
}

async function sellMany(router, nft, user, tokenIds) {
  await (await nft.connect(user).setApprovalForAll(router.address, true)).wait();
  for (const tokenId of tokenIds) {
    await (await router.connect(user).sellNFT(tokenId, 0)).wait();
  }
}

async function expectRevert(promise) {
  await assert.rejects(promise);
}

async function forceMarketState(pool, desiredState) {
  await ethers.provider.send("hardhat_setStorageAt", [
    pool.address,
    slotHex(MARKET_STATE_SLOT),
    valueHex(desiredState)
  ]);
  await ethers.provider.send("evm_mine", []);
}

async function setStabilizationSnapshot(pool, market, owner, floorOverride) {
  const floor = floorOverride || addBps(await pool.getFloorPrice(), 2000);
  await setUintVar(pool, "totalMinted", 10);
  await (await market.connect(owner).pause()).wait();
  await (await pool.connect(owner).setExternalMarketSnapshot(2, 1, floor)).wait();
  await (await market.connect(owner).unpause()).wait();
}

describe("PixelPool + PixelRouter economics flows", function () {
  it("buyback vaults stale inventory and recapitalizes pool reserve", async function () {
    const { owner, user, nft, pool, router, market, mintPrice } = await deployStack();

    await mintMany(router, user, mintPrice, 2);
    await seedReserves(
      pool,
      owner,
      ethers.utils.parseEther("6"),
      ethers.utils.parseEther("0.13")
    );

    await increaseTime(LAUNCH_PROTECTION + 1);
    await sellMany(router, nft, user, [0, 1]);

    const ethBefore = await pool.ethBalance();
    const treasuryBefore = await pool.treasuryBalance();

    await increaseTime(INVENTORY_STALE_AGE + 1);

    const [mode, maxBuy] = await pool.getBuybackMode();
    assert.strictEqual(mode.toString(), "1");
    assert.strictEqual(maxBuy.toString(), "2");

    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.availableNFTs()).toString(), "0");
    assert.strictEqual((await pool.vaultSize()).toString(), "2");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "0");
    assert((await pool.ethBalance()).gt(ethBefore));
    assert((await pool.treasuryBalance()).lt(treasuryBefore));
  });

  it("protocol burn reduces NFT total supply across immediate and aged vault burns", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintMany(router, user, mintPrice, 5);
    await seedReserves(
      pool,
      owner,
      ethers.utils.parseEther("10"),
      ethers.utils.parseEther("2")
    );

    await increaseTime(LAUNCH_PROTECTION + 1);
    await sellMany(router, nft, user, [0, 1, 2, 3, 4]);

    assert.strictEqual((await nft.totalSupply()).toString(), "5");
    assert.strictEqual((await pool.availableNFTs()).toString(), "5");

    await increaseTime(INVENTORY_STALE_AGE + 1);
    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.totalBurned()).toString(), "1");
    assert.strictEqual((await nft.totalSupply()).toString(), "4");
    await expectRevert(nft.ownerOf(0));

    await increaseTime(VAULT_BURN_AGE + 1);
    await (await pool.connect(owner).burnAgedVaultInventory(10)).wait();

    assert.strictEqual((await pool.totalBurned()).toString(), "5");
    assert.strictEqual((await nft.totalSupply()).toString(), "0");
    await expectRevert(nft.ownerOf(1));
  });

  it("burnAgedVaultInventory burns old vault items even when the newest vault entry is still fresh", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintMany(router, user, mintPrice, 3);
    await seedReserves(
      pool,
      owner,
      ethers.utils.parseEther("6"),
      ethers.utils.parseEther("0.13")
    );

    await increaseTime(LAUNCH_PROTECTION + 1);
    await sellMany(router, nft, user, [0, 1, 2]);

    await increaseTime(INVENTORY_STALE_AGE + 1);
    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.vaultSize()).toString(), "2");

    await increaseTime(VAULT_BURN_AGE + 1);
    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.vaultSize()).toString(), "3");
    assert.strictEqual((await nft.totalSupply()).toString(), "3");

    await (await pool.connect(owner).burnAgedVaultInventory(10)).wait();

    assert.strictEqual((await pool.vaultSize()).toString(), "1");
    assert.strictEqual((await pool.totalBurned()).toString(), "2");
    assert.strictEqual((await nft.totalSupply()).toString(), "1");
    await expectRevert(nft.ownerOf(2));
    await expectRevert(nft.ownerOf(1));
    assert.strictEqual(await nft.ownerOf(0), pool.address);
  });

  it("relist releases vault inventory to the listing vault without increasing sell pressure", async function () {
    const { owner, user, nft, pool, router, market, mintPrice } = await deployStack();

    await mintMany(router, user, mintPrice, 2);
    await seedReserves(
      pool,
      owner,
      ethers.utils.parseEther("6"),
      ethers.utils.parseEther("0.07")
    );

    await increaseTime(LAUNCH_PROTECTION + 1);
    await sellMany(router, nft, user, [0, 1]);

    await increaseTime(INVENTORY_STALE_AGE + 1);
    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.availableNFTs()).toString(), "1");
    assert.strictEqual((await pool.vaultSize()).toString(), "1");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");

    const targetPrice = await pool.getVaultListingTarget(1);
    const releaseReadyFloor = addBps(await pool.getFloorPrice(), 2500);
    const observedFloor = targetPrice.gt(releaseReadyFloor)
      ? targetPrice
      : releaseReadyFloor;
    await setStabilizationSnapshot(pool, market, owner, observedFloor);
    assert.strictEqual((await pool.marketState()).toString(), "1");

    await (await pool.connect(owner).relistFromVault(1)).wait();

    assert.strictEqual(await nft.ownerOf(1), market.address);
    assert.strictEqual((await pool.availableNFTs()).toString(), "1");
    assert.strictEqual((await pool.vaultSize()).toString(), "0");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");
  });
});
