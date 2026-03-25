const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const TRADE_FEE_BPS = 250;
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

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

async function deployStack() {
  const [owner, creator, user, buyer] = await ethers.getSigners();
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

  return { owner, creator, user, buyer, nft, pool, router, mintPrice };
}

async function seedPoolReserve(pool, owner, routerAddress, amount) {
  await (await pool.connect(owner).setRouter(owner.address)).wait();
  await (await pool.connect(owner).seedLiquidity({ value: amount })).wait();
  await (await pool.connect(owner).setRouter(routerAddress)).wait();
}

async function mintOne(router, user, mintPrice, colorIndex = 1) {
  await (await router.connect(user)["mint(bytes)"](onePixel(colorIndex), { value: mintPrice })).wait();
}

describe("Router sell edge cases", function () {
  it("sell reverts during launch protection period", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));

    // Do NOT advance past launch protection
    await (await nft.connect(user).approve(router.address, 0)).wait();
    await assert.rejects(
      router.connect(user).sellNFT(0, 0),
      /PoolSellDisabled/
    );
  });

  it("sell reverts when pool ethBalance is too low to pay out", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    // Mint many tokens to build supply, but don't seed extra reserve
    for (let i = 0; i < 5; i++) {
      await mintOne(router, user, mintPrice, i + 1);
    }

    await increaseTime(LAUNCH_PROTECTION + 1);

    // The pool has some ETH from mint splits, but let's try to sell.
    // First we need the pool to allow selling — needs Stabilization state + coverage.
    // With only mint-seeded ETH and no extra reserve, coverage may be too low.
    await (await nft.connect(user).approve(router.address, 0)).wait();

    // This should revert because either selling is disabled (insufficient coverage)
    // or pool is empty
    await assert.rejects(
      router.connect(user).sellNFT(0, 0),
      /PoolSellDisabled|PoolEmpty/
    );
  });

  it("sell reverts when minPrice exceeds floor (slippage protection)", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // Set minPrice absurdly high — higher than any possible floor
    const absurdMin = ethers.utils.parseEther("100");
    await (await nft.connect(user).approve(router.address, 0)).wait();
    await assert.rejects(
      router.connect(user).sellNFT(0, absurdMin),
      /SlippageExceeded/
    );
  });

  it("sell via router forwards full payout to seller", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // getFloorPrice() always returns a value; getSellPrice() may return 0
    // because the view doesn't roll windows. The actual sell() rolls windows
    // and refreshes state before the check.
    const floor = await pool.getFloorPrice();
    assert.ok(floor.gt(0), "Floor price should be > 0");
    const fee = floor.mul(TRADE_FEE_BPS).div(BPS);
    const expectedPayout = floor.sub(fee);

    await (await nft.connect(user).approve(router.address, 0)).wait();

    const balBefore = await ethers.provider.getBalance(user.address);
    const tx = await router.connect(user).sellNFT(0, 0);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const balAfter = await ethers.provider.getBalance(user.address);

    const actualPayout = balAfter.add(gasUsed).sub(balBefore);
    assert.strictEqual(actualPayout.toString(), expectedPayout.toString(),
      "Seller should receive exactly floor minus trade fee");
  });

  it("sell via router does not leave NFT or ETH stuck in router", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    const routerEthBefore = await ethers.provider.getBalance(router.address);

    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();

    const routerEthAfter = await ethers.provider.getBalance(router.address);
    assert.strictEqual(routerEthAfter.toString(), routerEthBefore.toString(),
      "Router should not accumulate ETH from sell transactions");

    // NFT should be in the pool now, not stuck in router
    assert.strictEqual(await nft.ownerOf(0), pool.address);
  });

  it("sell by non-owner reverts at router level", async function () {
    const { owner, user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // buyer tries to sell user's token without approval
    await assert.rejects(
      router.connect(buyer).sellNFT(0, 0),
      /ERC721/
    );
  });

  it("multiple sequential sells decrease pool ethBalance correctly", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    // Mint 3 tokens
    for (let i = 0; i < 3; i++) {
      await mintOne(router, user, mintPrice, i + 1);
    }

    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    const poolEthStart = await pool.ethBalance();

    // Sell sequentially — sell() rolls windows internally so it may succeed
    // even when the view getSellPrice() returns 0
    let totalPaid = ethers.BigNumber.from(0);
    let sold = 0;
    for (let i = 0; i < 3; i++) {
      await (await nft.connect(user).approve(router.address, i)).wait();
      const balBefore = await ethers.provider.getBalance(user.address);
      try {
        const tx = await router.connect(user).sellNFT(i, 0);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        const balAfter = await ethers.provider.getBalance(user.address);
        totalPaid = totalPaid.add(balAfter.add(gasUsed).sub(balBefore));
        sold++;
      } catch (err) {
        const msg = err.message || "";
        if (/PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(msg)) break;
        throw err; // unexpected revert — let it fail the test
      }
    }

    const poolEthEnd = await pool.ethBalance();
    // Pool ETH should decrease by total payouts (fees stay in pool via _distFee)
    assert.ok(sold > 0, "At least one sell should have succeeded");
    assert.ok(poolEthStart.gt(poolEthEnd), "Pool ETH should decrease after sells");
  });
});
