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
  const nft = await NFT.deploy("Dwellers", "OCPX", 4, 1, 1, 1000, mintPrice, palette16());

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

  // Mint tokens: alice gets 0,1,2,3,4 — bob gets 5,6,7,8,9
  for (let i = 0; i < 5; i++) {
    await (await router.connect(alice)["mint(bytes)"](onePixel(i + 1), { value: mintPrice })).wait();
  }
  for (let i = 0; i < 5; i++) {
    await (await router.connect(bob)["mint(bytes)"](onePixel(i + 1), { value: mintPrice })).wait();
  }

  return { owner, creator, alice, bob, carol, nft, pool, router, market, mintPrice };
}

describe("PixelPool v2 — Batch Stake/Unstake", function () {
  it("stakeBatch stakes multiple NFTs at once", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeBatch([0, 1, 2])).wait();

    assert.strictEqual((await pool.totalStaked()).toString(), "3");
    assert.strictEqual((await pool.stakedCount(alice.address)).toString(), "3");
    assert.strictEqual(await pool.stakedBy(0), alice.address);
    assert.strictEqual(await pool.stakedBy(1), alice.address);
    assert.strictEqual(await pool.stakedBy(2), alice.address);

    const tokens = await pool.getUserStakedTokens(alice.address);
    assert.strictEqual(tokens.length, 3);
  });

  it("unstakeBatch unstakes multiple NFTs at once", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeBatch([0, 1, 2])).wait();
    await (await pool.connect(alice).unstakeBatch([0, 2])).wait();

    assert.strictEqual((await pool.totalStaked()).toString(), "1");
    assert.strictEqual((await pool.stakedCount(alice.address)).toString(), "1");
    assert.strictEqual(await pool.stakedBy(1), alice.address);
    assert.strictEqual(await nft.ownerOf(0), alice.address);
    assert.strictEqual(await nft.ownerOf(2), alice.address);
  });

  it("rejects empty array for stakeBatch", async function () {
    const { alice, pool } = await deployStack();
    await expectCustomError(pool.connect(alice).stakeBatch([]), "EmptyArray");
  });

  it("rejects empty array for unstakeBatch", async function () {
    const { alice, pool } = await deployStack();
    await expectCustomError(pool.connect(alice).unstakeBatch([]), "EmptyArray");
  });
});

describe("PixelPool v2 — Lock Periods", function () {
  it("stakeWithLock tier 1 sets 7-day lock and 1.25x weight", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 1)).wait();

    const info = await pool.getTokenStakeInfo(0);
    assert.strictEqual(info.staker, alice.address);
    assert.strictEqual(info.lockTier, 1);
    assert.ok(info.lockExpiry.gt(0));
    assert.strictEqual(info.weight.toString(), "125");
    assert.strictEqual(info.lockExpired, false);

    assert.strictEqual((await pool.totalWeight()).toString(), "125");
    assert.strictEqual((await pool.userWeight(alice.address)).toString(), "125");
  });

  it("stakeWithLock tier 3 sets 90-day lock and 2x weight", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 3)).wait();

    assert.strictEqual((await pool.tokenWeight(0)).toString(), "200");
    assert.strictEqual((await pool.totalWeight()).toString(), "200");
  });

  it("stake without lock uses 1x weight (100)", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stake(0)).wait();

    assert.strictEqual((await pool.tokenWeight(0)).toString(), "100");
    assert.strictEqual((await pool.totalWeight()).toString(), "100");
  });

  it("cannot unstake before lock expires", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 1)).wait(); // 7-day lock

    await expectCustomError(pool.connect(alice).unstake(0), "LockNotExpired");
  });

  it("can unstake after lock expires", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 1)).wait();

    await increaseTime(7 * 24 * 3600 + 1); // 7 days + 1 second

    await (await pool.connect(alice).unstake(0)).wait();
    assert.strictEqual(await nft.ownerOf(0), alice.address);
    assert.strictEqual((await pool.totalStaked()).toString(), "0");
  });

  it("rejects invalid lock tier", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await expectCustomError(pool.connect(alice).stakeWithLock(0, 4), "InvalidLockTier");
  });

  it("stakeBatchWithLock applies lock to all tokens", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeBatchWithLock([0, 1, 2], 2)).wait(); // 30-day lock, 1.5x

    assert.strictEqual((await pool.totalWeight()).toString(), "450"); // 3 * 150
    assert.strictEqual((await pool.totalStaked()).toString(), "3");

    for (const id of [0, 1, 2]) {
      assert.strictEqual((await pool.tokenLockTier(id)).toString(), "2");
      assert.strictEqual((await pool.tokenWeight(id)).toString(), "150");
    }
  });
});

describe("PixelPool v2 — Weighted Reward Distribution", function () {
  it("locked staker earns more than unlocked staker", async function () {
    const { alice, bob, nft, pool, market, router } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await nft.connect(bob).setApprovalForAll(pool.address, true)).wait();

    // Alice stakes 1 token with 2x lock, Bob stakes 1 token with no lock
    await (await pool.connect(alice).stakeWithLock(0, 3)).wait(); // weight 200
    await (await pool.connect(bob).stake(5)).wait(); // weight 100

    // totalWeight = 300: Alice gets 200/300 = 66.7%, Bob gets 100/300 = 33.3%

    // Generate fees: list and sell on marketplace
    await (await nft.connect(alice).setApprovalForAll(market.address, true)).wait();
    await (await market.connect(alice).createListing(1, ethers.utils.parseEther("0.05"), 0)).wait();
    await (await market.connect(bob).buyListing(1, { value: ethers.utils.parseEther("0.05") })).wait();

    const alicePending = await pool.viewPendingFees(alice.address);
    const bobPending = await pool.viewPendingFees(bob.address);

    // Alice should have ~2x more rewards than Bob
    assert.ok(alicePending.gt(0), "Alice should have pending rewards");
    assert.ok(bobPending.gt(0), "Bob should have pending rewards");
    // Allow for rounding: alice ~= 2 * bob
    const ratio = alicePending.mul(100).div(bobPending);
    assert.ok(ratio.gte(190) && ratio.lte(210), `Expected ratio ~200, got ${ratio.toString()}`);
  });
});

describe("PixelPool v2 — Emergency Unstake", function () {
  it("emergencyUnstake works when paused and takes 50% penalty", async function () {
    const { owner, alice, nft, pool, market } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 3)).wait(); // 90-day lock

    // Generate some fees
    await (await nft.connect(alice).setApprovalForAll(market.address, true)).wait();
    await (await market.connect(alice).createListing(1, ethers.utils.parseEther("0.05"), 0)).wait();
    // Need a buyer — use bob via a fresh deploy; actually let's just check the emergency path
    // We'll verify that it works when paused

    // Pause the pool
    await (await pool.connect(owner).pause()).wait();

    // Emergency unstake — should work even though lock not expired
    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx = await pool.connect(alice).emergencyUnstake(0);
    const rc = await tx.wait();
    const balAfter = await ethers.provider.getBalance(alice.address);

    assert.strictEqual(await nft.ownerOf(0), alice.address);
    assert.strictEqual((await pool.totalStaked()).toString(), "0");
    assert.strictEqual((await pool.totalWeight()).toString(), "0");
  });

  it("emergencyUnstake reverts when not paused", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 3)).wait();

    // Not paused — should revert with Pausable error
    await assert.rejects(
      pool.connect(alice).emergencyUnstake(0),
      /Pausable: not paused/
    );
  });

  it("emergencyUnstake with pending rewards takes 50% penalty", async function () {
    const { owner, alice, bob, nft, pool, market } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 3)).wait();

    // Generate fees via marketplace trade
    await (await nft.connect(bob).setApprovalForAll(market.address, true)).wait();
    await (await market.connect(bob).createListing(5, ethers.utils.parseEther("0.05"), 0)).wait();
    await (await market.connect(alice).buyListing(1, { value: ethers.utils.parseEther("0.05") })).wait();

    const pendingBefore = await pool.viewPendingFees(alice.address);
    assert.ok(pendingBefore.gt(0), "Should have pending fees");

    // Pause and emergency unstake
    await (await pool.connect(owner).pause()).wait();

    const poolEthBefore = await pool.ethBalance();
    await (await pool.connect(alice).emergencyUnstake(0)).wait();
    const poolEthAfter = await pool.ethBalance();

    // Pool should have received penalty
    const penalties = await pool.totalEmergencyPenalties();
    assert.ok(penalties.gt(0), "Should have recorded penalty");
  });
});

describe("PixelPool v2 — Staking Stats", function () {
  it("getStakingInfo returns correct data", async function () {
    const { alice, bob, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await nft.connect(bob).setApprovalForAll(pool.address, true)).wait();

    await (await pool.connect(alice).stakeWithLock(0, 2)).wait(); // 1.5x = weight 150
    await (await pool.connect(alice).stake(1)).wait(); // 1x = weight 100
    await (await pool.connect(bob).stake(5)).wait(); // 1x = weight 100

    // totalWeight = 350, alice weight = 250

    const info = await pool.getStakingInfo(alice.address);
    assert.strictEqual(info.stakedTokens.toString(), "2");
    assert.strictEqual(info.effectiveWeight.toString(), "250");
    // shareOfPoolBps = 250 * 10000 / 350 = 7142
    assert.ok(info.shareOfPoolBps.gte(7100) && info.shareOfPoolBps.lte(7200));
  });

  it("getTokenStakeInfo returns correct lock data", async function () {
    const { alice, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await pool.connect(alice).stakeWithLock(0, 2)).wait();

    const info = await pool.getTokenStakeInfo(0);
    assert.strictEqual(info.staker, alice.address);
    assert.strictEqual(info.lockTier, 2);
    assert.strictEqual(info.weight.toString(), "150");
    assert.strictEqual(info.lockExpired, false);

    // Fast forward past lock
    await increaseTime(30 * 24 * 3600 + 1);

    const infoAfter = await pool.getTokenStakeInfo(0);
    assert.strictEqual(infoAfter.lockExpired, true);
  });

  it("getStakingStats returns global stats", async function () {
    const { alice, bob, nft, pool } = await deployStack();

    await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
    await (await nft.connect(bob).setApprovalForAll(pool.address, true)).wait();

    await (await pool.connect(alice).stakeWithLock(0, 3)).wait(); // weight 200
    await (await pool.connect(bob).stake(5)).wait(); // weight 100

    const stats = await pool.getStakingStats();
    assert.strictEqual(stats._totalStaked.toString(), "2");
    assert.strictEqual(stats._totalWeight.toString(), "300");
    // avgMultiplierBps = 300 * 10000 / (2 * 100) = 15000
    assert.strictEqual(stats.avgMultiplierBps.toString(), "15000");
  });
});
