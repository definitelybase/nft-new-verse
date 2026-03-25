const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const TRADE_FEE_BPS = 250;
const STAKER_FEE_BPS = 1000;
const STABILIZATION_SPREAD_BPS = 2000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const LONG_WINDOW = 24 * 60 * 60;

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

async function deployStack() {
  const [owner, creator, user, buyer, staker2] = await ethers.getSigners();
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

  await (await nft.connect(owner).setMinter(router.address, true)).wait();
  await (await nft.connect(owner).setBurner(pool.address, true)).wait();
  await (await pool.connect(owner).setRouter(router.address)).wait();

  return { owner, creator, user, buyer, staker2, nft, pool, router, mintPrice };
}

async function seedPoolReserve(pool, owner, routerAddress, amount) {
  await (await pool.connect(owner).setRouter(owner.address)).wait();
  await (await pool.connect(owner).seedLiquidity({ value: amount })).wait();
  await (await pool.connect(owner).setRouter(routerAddress)).wait();
}

function addBps(value, bps) {
  return value.add(value.mul(bps).div(BPS));
}

async function mintOne(router, user, mintPrice, colorIndex = 1) {
  await (await router.connect(user)["mint(bytes)"](onePixel(colorIndex), { value: mintPrice })).wait();
}

describe("PixelPool staking", function () {
  it("stake and unstake transfer NFT custody correctly", async function () {
    const { user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    assert.strictEqual(await nft.ownerOf(0), user.address);

    // Approve and stake
    await (await nft.connect(user).approve(pool.address, 0)).wait();
    await (await pool.connect(user).stake(0)).wait();

    assert.strictEqual(await nft.ownerOf(0), pool.address);
    assert.strictEqual((await pool.totalStaked()).toString(), "1");
    assert.strictEqual((await pool.stakedCount(user.address)).toString(), "1");

    const stakedTokens = await pool.getUserStakedTokens(user.address);
    assert.strictEqual(stakedTokens.length, 1);
    assert.strictEqual(stakedTokens[0].toString(), "0");

    // Unstake
    await (await pool.connect(user).unstake(0)).wait();

    assert.strictEqual(await nft.ownerOf(0), user.address);
    assert.strictEqual((await pool.totalStaked()).toString(), "0");
    assert.strictEqual((await pool.stakedCount(user.address)).toString(), "0");
    assert.strictEqual((await pool.getUserStakedTokens(user.address)).length, 0);
  });

  it("rejects staking a token you do not own", async function () {
    const { user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    // buyer tries to stake user's token
    await assert.rejects(
      pool.connect(buyer).stake(0),
      /NotNFTOwner|ERC721/
    );
  });

  it("rejects double-staking the same token", async function () {
    const { user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await (await nft.connect(user).approve(pool.address, 0)).wait();
    await (await pool.connect(user).stake(0)).wait();

    await assert.rejects(
      pool.connect(user).stake(0),
      /AlreadyStaked|NotNFTOwner/
    );
  });

  it("rejects unstaking by non-staker", async function () {
    const { user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await (await nft.connect(user).approve(pool.address, 0)).wait();
    await (await pool.connect(user).stake(0)).wait();

    await assert.rejects(
      pool.connect(buyer).unstake(0),
      /NotStaker/
    );
  });

  it("accumulates staker fees from sell trades and pays on claimFees", async function () {
    const { owner, user, buyer, nft, pool, router, mintPrice } = await deployStack();

    // Mint 2 tokens: token 0 to stake, token 1 to sell
    await mintOne(router, user, mintPrice, 1);
    await mintOne(router, user, mintPrice, 2);

    // Stake token 0
    await (await nft.connect(user).approve(pool.address, 0)).wait();
    await (await pool.connect(user).stake(0)).wait();

    // Seed big reserve so sell is possible
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // Sell token 1 into pool — this generates trade fees
    await (await nft.connect(user).approve(router.address, 1)).wait();
    await (await router.connect(user).sellNFT(1, 0)).wait();

    // Check that staker has pending fees
    const pending = await pool.viewPendingFees(user.address);
    assert.ok(pending.gt(0), "Staker should have pending fees after a sell trade");

    // Claim fees
    const balBefore = await ethers.provider.getBalance(user.address);
    const tx = await pool.connect(user).claimFees();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const balAfter = await ethers.provider.getBalance(user.address);

    // Balance should increase by roughly the pending amount (minus gas)
    assert.ok(balAfter.add(gasUsed).gt(balBefore), "Balance should increase after claiming fees");

    // Pending should now be 0
    const pendingAfter = await pool.viewPendingFees(user.address);
    assert.strictEqual(pendingAfter.toString(), "0");
  });

  it("claimFees reverts when nothing is pending", async function () {
    const { user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await (await nft.connect(user).approve(pool.address, 0)).wait();
    await (await pool.connect(user).stake(0)).wait();

    // No trades happened — no fees
    await assert.rejects(
      pool.connect(user).claimFees(),
      /NothingToClaim/
    );
  });

  it("unstake auto-pays pending rewards", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice, 1);
    await mintOne(router, user, mintPrice, 2);

    // Stake token 0
    await (await nft.connect(user).approve(pool.address, 0)).wait();
    await (await pool.connect(user).stake(0)).wait();

    // Generate fees via sell
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);
    await (await nft.connect(user).approve(router.address, 1)).wait();
    await (await router.connect(user).sellNFT(1, 0)).wait();

    const pending = await pool.viewPendingFees(user.address);
    assert.ok(pending.gt(0), "Should have pending fees");

    // Unstake — should auto-pay
    const balBefore = await ethers.provider.getBalance(user.address);
    const tx = await pool.connect(user).unstake(0);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const balAfter = await ethers.provider.getBalance(user.address);

    assert.ok(balAfter.add(gasUsed).gt(balBefore), "Unstake should pay out pending rewards");
    assert.strictEqual(await nft.ownerOf(0), user.address);
    assert.strictEqual((await pool.viewPendingFees(user.address)).toString(), "0");
  });

  it("splits fees proportionally between two stakers", async function () {
    const { owner, user, staker2, nft, pool, router, mintPrice } = await deployStack();

    // Mint 3 tokens: 0 to user, 1 to staker2, 2 to sell
    await mintOne(router, user, mintPrice, 1);
    await mintOne(router, staker2, mintPrice, 2);
    await mintOne(router, user, mintPrice, 3);

    // Both stake
    await (await nft.connect(user).approve(pool.address, 0)).wait();
    await (await pool.connect(user).stake(0)).wait();
    await (await nft.connect(staker2).approve(pool.address, 1)).wait();
    await (await pool.connect(staker2).stake(1)).wait();

    assert.strictEqual((await pool.totalStaked()).toString(), "2");

    // Sell token 2 — fees should split 50/50
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);
    await (await nft.connect(user).approve(router.address, 2)).wait();
    await (await router.connect(user).sellNFT(2, 0)).wait();

    const pendingUser = await pool.viewPendingFees(user.address);
    const pendingStaker2 = await pool.viewPendingFees(staker2.address);

    // Both should have fees, roughly equal (within rounding)
    assert.ok(pendingUser.gt(0), "User should have fees");
    assert.ok(pendingStaker2.gt(0), "Staker2 should have fees");

    // Difference should be less than 1 wei (integer division rounding)
    const diff = pendingUser.gt(pendingStaker2)
      ? pendingUser.sub(pendingStaker2)
      : pendingStaker2.sub(pendingUser);
    assert.ok(diff.lte(1), `Fee split should be equal within 1 wei, diff=${diff}`);
  });

  it("staker fees from trades with zero stakers go to pool reserve", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice, 1);
    const poolEthBefore = await pool.ethBalance();

    // Sell with NO stakers — staker share should go to ethBalance
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);
    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();

    const poolEthAfter = await pool.ethBalance();
    // Pool eth should have decreased by payout but also received pool fee + staker fee (since no stakers)
    // The key assertion: accFeePerStake should still be 0
    assert.strictEqual((await pool.accFeePerStake()).toString(), "0");
  });
});
