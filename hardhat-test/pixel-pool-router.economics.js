const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const INVENTORY_STALE_AGE = 7 * 24 * 60 * 60;
const VAULT_BURN_AGE = 14 * 24 * 60 * 60;

let cachedMarketStateSlot;

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
  if (cachedMarketStateSlot === undefined) {
    for (let candidate = 0; candidate < 40; candidate++) {
      const slot = slotHex(candidate);
      const original = await ethers.provider.getStorageAt(pool.address, slot);
      await ethers.provider.send("hardhat_setStorageAt", [pool.address, slot, valueHex(1)]);
      await ethers.provider.send("evm_mine", []);

      const state = await pool.marketState();
      if (Number(state) === 1) {
        cachedMarketStateSlot = candidate;
        break;
      }

      await ethers.provider.send("hardhat_setStorageAt", [pool.address, slot, original]);
      await ethers.provider.send("evm_mine", []);
    }
  }

  if (cachedMarketStateSlot === undefined) {
    throw new Error("Unable to locate marketState storage slot");
  }

  await ethers.provider.send("hardhat_setStorageAt", [
    pool.address,
    slotHex(cachedMarketStateSlot),
    valueHex(desiredState)
  ]);
  await ethers.provider.send("evm_mine", []);
}

describe("PixelPool + PixelRouter economics flows", function () {
  it("buyback vaults stale inventory and recapitalizes pool reserve", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

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
    assert.strictEqual(maxBuy.toString(), "1");

    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.availableNFTs()).toString(), "1");
    assert.strictEqual((await pool.vaultSize()).toString(), "1");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");
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

  it("relist restores vault inventory to pool without increasing sell pressure", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintMany(router, user, mintPrice, 2);
    await seedReserves(
      pool,
      owner,
      ethers.utils.parseEther("6"),
      ethers.utils.parseEther("0.13")
    );

    await increaseTime(LAUNCH_PROTECTION + 1);
    await sellMany(router, nft, user, [0, 1]);

    await increaseTime(INVENTORY_STALE_AGE + 1);
    await (await pool.connect(owner).executeBuyback()).wait();

    assert.strictEqual((await pool.availableNFTs()).toString(), "1");
    assert.strictEqual((await pool.vaultSize()).toString(), "1");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");

    await forceMarketState(pool, 1);
    assert.strictEqual((await pool.marketState()).toString(), "1");

    await (await pool.connect(owner).relistFromVault(1)).wait();

    assert.strictEqual((await pool.availableNFTs()).toString(), "2");
    assert.strictEqual((await pool.vaultSize()).toString(), "0");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");
  });
});
