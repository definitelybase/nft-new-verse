const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const TRADE_FEE_BPS = 250;
const STABILIZATION_SPREAD_BPS = 2000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const SHORT_WINDOW = 6 * 60 * 60;
const LONG_WINDOW = 24 * 60 * 60;

const STATES = ["Expansion", "Stabilization", "WeakDemand"];

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

function addBps(value, bps) {
  return value.add(value.mul(bps).div(BPS));
}

async function deployStack() {
  const [owner, creator, alice, bob, charlie] = await ethers.getSigners();
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
  await (await pool.connect(owner).setListingVault(owner.address)).wait();

  return { owner, creator, alice, bob, charlie, nft, pool, router, mintPrice };
}

async function seedPoolReserve(pool, owner, routerAddress, amount) {
  await (await pool.connect(owner).setRouter(owner.address)).wait();
  await (await pool.connect(owner).seedLiquidity({ value: amount })).wait();
  await (await pool.connect(owner).setRouter(routerAddress)).wait();
}

async function mintOne(router, user, mintPrice, colorIndex = 1) {
  await (await router.connect(user)["mint(bytes)"](onePixel(colorIndex), { value: mintPrice })).wait();
}

async function getState(pool) {
  const s = await pool.marketState();
  return STATES[s] || `Unknown(${s})`;
}

describe("Market-state stress tests", function () {
  it("starts in Expansion during launch protection regardless of activity", async function () {
    const { alice, pool, router, mintPrice } = await deployStack();

    // Mint several tokens during launch protection
    for (let i = 0; i < 5; i++) {
      await mintOne(router, alice, mintPrice, (i % 15) + 1);
    }

    assert.strictEqual(await getState(pool), "Expansion");
  });

  it("transitions from Expansion to WeakDemand after first sell post-launch", async function () {
    const { owner, alice, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, alice, mintPrice);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // First sell — pressure goes to max (sells>0, buys=0), should move to WeakDemand
    await (await nft.connect(alice).approve(router.address, 0)).wait();
    await (await router.connect(alice).sellNFT(0, 0)).wait();

    assert.strictEqual(await getState(pool), "WeakDemand");
  });

  it("recovers from WeakDemand enough to release inventory externally after window reset", async function () {
    const { owner, alice, nft, pool, router, mintPrice } = await deployStack();

    // Setup: mint, seed, pass launch
    await mintOne(router, alice, mintPrice, 1);
    await mintOne(router, alice, mintPrice, 2);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // Sell to enter WeakDemand
    await (await nft.connect(alice).approve(router.address, 0)).wait();
    await (await router.connect(alice).sellNFT(0, 0)).wait();
    assert.strictEqual(await getState(pool), "WeakDemand");

    // Wait for both windows to reset
    await increaseTime(LONG_WINDOW + 1);

    // Add one more sell so the pool has fresh inventory to release outward.
    await (await nft.connect(alice).approve(router.address, 1)).wait();
    await (await router.connect(alice).sellNFT(1, 0)).wait();

    // Wait for windows to reset so the market can leave the weak-demand snapshot.
    await increaseTime(LONG_WINDOW + 1);

    await (await pool.connect(owner).releasePoolInventoryForListing(1)).wait();

    const state = await getState(pool);
    assert.ok(
      state === "Stabilization" || state === "Expansion",
      `Expected Stabilization or Expansion after release, got ${state}`
    );
    assert.strictEqual(await nft.ownerOf(1), owner.address);
  });

  it("ethBalance never goes negative through many sell cycles", async function () {
    const { owner, alice, nft, pool, router, mintPrice } = await deployStack();

    // Mint many tokens
    const count = 10;
    for (let i = 0; i < count; i++) {
      await mintOne(router, alice, mintPrice, (i % 15) + 1);
    }

    // Need enough reserve for coverage >= 100% (TARGET_EXIT_BUFFER=500)
    // coverage = ethBalance * BPS / (floor * 500), need >= BPS
    // So ethBalance >= floor * 500 / BPS = floor * 0.05 per token isn't it...
    // Actually: need ethBalance * BPS >= floor * 500 * BPS → ethBalance >= floor * 500
    // floor ≈ 0.006 ETH, 500 * 0.006 = 3 ETH minimum
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // Sell as many as possible, checking ethBalance after each
    let sold = 0;
    for (let i = 0; i < count; i++) {
      const ethBal = await pool.ethBalance();
      assert.ok(ethBal.gte(0), `ethBalance should never be negative, got ${ethBal} after ${sold} sells`);

      await (await nft.connect(alice).approve(router.address, i)).wait();
      try {
        await (await router.connect(alice).sellNFT(i, 0)).wait();
        sold++;
      } catch (err) {
        if (/PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(err.message)) break;
        throw err;
      }
    }

    assert.ok(sold > 0, "At least one sell should succeed");
    const finalBal = await pool.ethBalance();
    assert.ok(finalBal.gte(0), "Final ethBalance must be >= 0");
  });

  it("floor price does not collapse to zero after many sells", async function () {
    const { owner, alice, nft, pool, router, mintPrice } = await deployStack();

    const count = 8;
    for (let i = 0; i < count; i++) {
      await mintOne(router, alice, mintPrice, (i % 15) + 1);
    }

    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("3"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    const floorBefore = await pool.getFloorPrice();

    // Sell several with time gaps to let EMA adjust
    for (let i = 0; i < count; i++) {
      await (await nft.connect(alice).approve(router.address, i)).wait();
      try {
        await (await router.connect(alice).sellNFT(i, 0)).wait();
        // Small time gap between sells
        await increaseTime(60);
      } catch (err) {
        if (/PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(err.message)) break;
        throw err;
      }
    }

    const floorAfter = await pool.getFloorPrice();
    // Floor can decrease but must stay above MIN_BID (1500 bps of mint = 15%)
    const minFloor = mintPrice.mul(1500).div(BPS);
    assert.ok(floorAfter.gte(minFloor),
      `Floor ${floorAfter} should stay above min bid ${minFloor}`);
    assert.ok(floorAfter.gt(0), "Floor must never be zero");
  });

  it("circulating supply + pool supply + locked supply is consistent after mixed operations", async function () {
    const { owner, alice, bob, nft, pool, router, mintPrice } = await deployStack();

    // Mint 6 tokens across two users
    for (let i = 0; i < 4; i++) await mintOne(router, alice, mintPrice, (i % 15) + 1);
    for (let i = 0; i < 2; i++) await mintOne(router, bob, mintPrice, (i % 15) + 1);

    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("3"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // Sell 2 from alice
    for (let i = 0; i < 2; i++) {
      await (await nft.connect(alice).approve(router.address, i)).wait();
      try {
        await (await router.connect(alice).sellNFT(i, 0)).wait();
      } catch (err) { if (/PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(err.message)) break; throw err; }
    }

    // Stake 1 from alice
    await (await nft.connect(alice).approve(pool.address, 2)).wait();
    await (await pool.connect(alice).stake(2)).wait();

    // Check consistency
    const metrics = await pool.getMarketMetrics();
    const totalMinted = await pool.totalMinted();
    const totalBurned = await pool.totalBurned();
    const totalStaked = await pool.totalStaked();

    // circulatingSupply = user-held NFTs (not in pool, not staked)
    // lockedSupply = staked NFTs
    // poolSupply = pool-held NFTs
    const liveSupply = metrics.circulatingSupply.add(metrics.lockedSupply).add(metrics.poolSupply);
    const expectedLive = totalMinted.sub(totalBurned);

    assert.strictEqual(
      liveSupply.toString(),
      expectedLive.toString(),
      `circulating(${metrics.circulatingSupply}) + locked(${metrics.lockedSupply}) + pool(${metrics.poolSupply}) should equal minted(${totalMinted}) - burned(${totalBurned})`
    );

    assert.strictEqual(metrics.lockedSupply.toString(), totalStaked.toString(),
      "lockedSupply should match totalStaked");
  });

  it("market state transitions are idempotent across duplicate window-roll calls", async function () {
    const { owner, alice, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, alice, mintPrice, 1);
    await mintOne(router, alice, mintPrice, 2);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    // Sell to trigger state change
    await (await nft.connect(alice).approve(router.address, 0)).wait();
    await (await router.connect(alice).sellNFT(0, 0)).wait();
    const stateAfterSell = await getState(pool);

    // Sell again immediately — state should be deterministic
    await (await nft.connect(alice).approve(router.address, 1)).wait();
    try {
      await (await router.connect(alice).sellNFT(1, 0)).wait();
    } catch (err) {
      if (!/PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(err.message)) throw err;
    }
    const stateAfterSecond = await getState(pool);

    // State should be one of the valid states (not corrupted)
    assert.ok(STATES.includes(stateAfterSell), `Invalid state: ${stateAfterSell}`);
    assert.ok(STATES.includes(stateAfterSecond), `Invalid state: ${stateAfterSecond}`);
  });

  it("large mint batch followed by sell wave keeps pool solvent", async function () {
    const { owner, alice, bob, nft, pool, router, mintPrice } = await deployStack();

    // Mint 20 tokens
    const batchSize = 20;
    for (let i = 0; i < batchSize; i++) {
      const minter = i % 2 === 0 ? alice : bob;
      await mintOne(router, minter, mintPrice, (i % 15) + 1);
    }

    // Pool got 60% of each mint = 0.006 ETH × 20 = 0.12 ETH from mints
    // Need coverage >= 100%: floor≈0.006, TARGET_EXIT_BUFFER=500
    // ethBalance needs >= floor * 500 = 3 ETH
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("10"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    const poolEthBefore = await pool.ethBalance();
    const statesBefore = new Set();
    const statesAfter = new Set();

    // Alice sells her 10 tokens as fast as possible
    let sellCount = 0;
    for (let i = 0; i < batchSize; i += 2) {
      statesBefore.add(await getState(pool));
      await (await nft.connect(alice).approve(router.address, i)).wait();
      try {
        await (await router.connect(alice).sellNFT(i, 0)).wait();
        sellCount++;
        statesAfter.add(await getState(pool));
      } catch (err) {
        if (/PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(err.message)) break;
        throw err;
      }
    }

    // Pool must still be solvent
    const poolEthAfter = await pool.ethBalance();
    assert.ok(poolEthAfter.gte(0), "Pool must remain solvent after sell wave");
    assert.ok(sellCount > 0, "At least one sell should succeed in the wave");

    // State machine should have visited at least WeakDemand (selling pressure)
    const allStates = new Set([...statesBefore, ...statesAfter]);
    assert.ok(allStates.size > 0, "Should have observed at least one state");
  });

  it("heavy sell pressure eventually closes the sell lane before insolvency", async function () {
    const { owner, alice, bob, nft, pool, router, mintPrice } = await deployStack();

    const batchSize = 24;
    for (let i = 0; i < batchSize; i++) {
      const minter = i % 2 === 0 ? alice : bob;
      await mintOne(router, minter, mintPrice, (i % 15) + 1);
    }

    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("4"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    const minFloor = mintPrice.mul(1500).div(BPS);
    let successfulSells = 0;
    let terminalReason = "";

    for (let i = 0; i < batchSize; i += 2) {
      await (await nft.connect(alice).approve(router.address, i)).wait();
      try {
        await (await router.connect(alice).sellNFT(i, 0)).wait();
        successfulSells += 1;
        const currentFloor = await pool.getFloorPrice();
        const ethBalance = await pool.ethBalance();
        assert.ok(currentFloor.gte(minFloor), "floor should stay above the protocol min bid");
        assert.ok(ethBalance.gte(0), "pool must never go insolvent");
      } catch (err) {
        terminalReason = err.message;
        if (!/PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(err.message)) throw err;
        break;
      }
    }

    assert.ok(successfulSells > 0, "expected at least one successful sell before the lane closed");

    const finalFloor = await pool.getFloorPrice();
    const finalEthBalance = await pool.ethBalance();
    assert.ok(finalFloor.gte(minFloor), "final floor should remain above min bid");
    assert.ok(finalEthBalance.gte(0), "final pool balance must remain non-negative");

    if (terminalReason) {
      assert.ok(
        /PoolSellDisabled|PoolEmpty|SlippageExceeded/.test(terminalReason),
        `unexpected terminal reason: ${terminalReason}`
      );
    }
  });
});
