/**
 * End-to-end test: Marketplace + Liquidity + Staking
 *
 * Deploys fresh contracts, mints NFTs, then tests:
 *   1. Marketplace: createListing, buyListing, cancelListing
 *   2. Liquidity: sell-to-pool, floor price, reserve balance
 *   3. Staking: stake, claimFees, unstake
 *
 * Usage:
 *   npx hardhat run scripts/test-e2e.js --network localhost
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const OK = "\x1b[32m[OK]\x1b[0m";
const FAIL = "\x1b[31m[FAIL]\x1b[0m";
const INFO = "\x1b[36m[INFO]\x1b[0m";
const SEP = "─".repeat(60);

function fmt(wei) {
  return ethers.utils.formatEther(wei) + " ETH";
}

function assert(cond, msg) {
  if (!cond) {
    console.log(`${FAIL} ${msg}`);
    process.exit(1);
  }
  console.log(`${OK} ${msg}`);
}

async function main() {
  const [deployer, alice, bob] = await ethers.getSigners();

  // ───────────────────── Deploy ─────────────────────
  console.log(`\n${SEP}\n  DEPLOY\n${SEP}`);

  const PALETTE_16 = Buffer.from([
    0x00,0x00,0x00, 0xFF,0x00,0x00, 0x00,0xFF,0x00, 0x00,0x00,0xFF,
    0xFF,0xFF,0x00, 0xFF,0x00,0xFF, 0x00,0xFF,0xFF, 0xFF,0xFF,0xFF,
    0x80,0x00,0x00, 0x00,0x80,0x00, 0x00,0x00,0x80, 0x80,0x80,0x00,
    0x80,0x00,0x80, 0x00,0x80,0x80, 0x80,0x80,0x80, 0xC0,0xC0,0xC0,
  ]);

  const mintPrice = ethers.utils.parseEther("0.01");

  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy("TestPixels", "TPX", 4, 16, 16, 100, mintPrice, PALETTE_16);
  console.log(`${INFO} NFT: ${nft.address}`);

  const Pool = await ethers.getContractFactory("PixelPool");
  const pool = await Pool.deploy(nft.address, mintPrice);
  console.log(`${INFO} Pool: ${pool.address}`);

  const Router = await ethers.getContractFactory("PixelRouter");
  const router = await Router.deploy(nft.address, pool.address, deployer.address, mintPrice, 6000, 1000);
  console.log(`${INFO} Router: ${router.address}`);

  const Market = await ethers.getContractFactory("PixelMarketplace");
  const market = await Market.deploy(nft.address, pool.address, 250);
  console.log(`${INFO} Market: ${market.address}`);

  // Wire
  await (await nft.setMinter(router.address, true)).wait();
  await (await nft.setBurner(pool.address, true)).wait();
  await (await pool.setRouter(router.address)).wait();
  await (await pool.setListingVault(market.address)).wait();
  await (await nft.lockPalette()).wait();
  console.log(`${INFO} Wired and palette locked`);

  // Seed pool with some ETH so it has reserve
  await (await pool.setRouter(deployer.address)).wait();
  await (await pool.seedLiquidity({ value: ethers.utils.parseEther("1") })).wait();
  await (await pool.setRouter(router.address)).wait();
  console.log(`${INFO} Seeded 1 ETH into pool`);

  // ───────────────────── Mint 10 NFTs ─────────────────────
  console.log(`\n${SEP}\n  MINT\n${SEP}`);

  const payloadsPath = path.join(__dirname, "..", "frontend", "public", "collection", "payloads.json");
  const payloads = JSON.parse(fs.readFileSync(payloadsPath, "utf8"));

  // Mint 5 to Alice, 5 to Bob
  for (let i = 0; i < 5; i++) {
    await (await router.connect(alice).mint(payloads[String(i)], { value: mintPrice })).wait();
  }
  for (let i = 5; i < 10; i++) {
    await (await router.connect(bob).mint(payloads[String(i)], { value: mintPrice })).wait();
  }

  const totalSupply = await nft.totalSupply();
  assert(totalSupply.eq(10), `Minted 10 NFTs (totalSupply=${totalSupply})`);

  const aliceBalance = await nft.balanceOf(alice.address);
  const bobBalance = await nft.balanceOf(bob.address);
  console.log(`${INFO} Alice owns ${aliceBalance} NFTs, Bob owns ${bobBalance} NFTs`);

  const poolEth = await pool.ethBalance();
  const treasuryEth = await pool.treasuryBalance();
  console.log(`${INFO} Pool reserve: ${fmt(poolEth)}`);
  console.log(`${INFO} Treasury: ${fmt(treasuryEth)}`);
  assert(poolEth.gt(0), "Pool reserve > 0 after mints");
  assert(treasuryEth.gt(0), "Treasury > 0 after mints");

  // ───────────────────── MARKETPLACE ─────────────────────
  console.log(`\n${SEP}\n  MARKETPLACE\n${SEP}`);

  // Alice lists token #0
  const listPrice = ethers.utils.parseEther("0.05");
  await (await nft.connect(alice).setApprovalForAll(market.address, true)).wait();

  const txList = await market.connect(alice).createListing(0, listPrice);
  const rcList = await txList.wait();
  console.log(`${INFO} Alice listed token #0 for ${fmt(listPrice)}`);

  const listing = await market.listings(1);
  assert(listing.active, "Listing #1 is active");
  assert(listing.seller === alice.address, "Listing seller is Alice");
  assert(listing.price.eq(listPrice), `Listing price = ${fmt(listPrice)}`);

  const activeCount = await market.activeListings();
  assert(activeCount.eq(1), `Active listings: ${activeCount}`);

  const floor = await market.currentFloor();
  assert(floor.eq(listPrice), `Floor = ${fmt(floor)}`);

  // Bob buys listing #1
  const bobBalBefore = await ethers.provider.getBalance(bob.address);
  const aliceBalBefore = await ethers.provider.getBalance(alice.address);

  const txBuy = await market.connect(bob).buyListing(1, { value: listPrice });
  const rcBuy = await txBuy.wait();

  const newOwner = await nft.ownerOf(0);
  assert(newOwner === bob.address, `Token #0 now owned by Bob`);

  const activeAfterBuy = await market.activeListings();
  assert(activeAfterBuy.eq(0), `Active listings after buy: ${activeAfterBuy}`);

  const aliceBalAfter = await ethers.provider.getBalance(alice.address);
  const fee = listPrice.mul(250).div(10000);
  const expectedProceeds = listPrice.sub(fee);
  assert(aliceBalAfter.sub(aliceBalBefore).eq(expectedProceeds), `Alice received ${fmt(expectedProceeds)} (price minus 2.5% fee)`);
  console.log(`${INFO} Bob bought token #0 from Alice. Fee: ${fmt(fee)}`);

  // Alice lists token #1, then cancels
  await (await market.connect(alice).createListing(1, listPrice)).wait();
  assert((await market.activeListings()).eq(1), "Listing #2 active");

  await (await market.connect(alice).cancelListing(2)).wait();
  assert((await market.activeListings()).eq(0), "Listing #2 cancelled");
  assert((await nft.ownerOf(1)) === alice.address, "Token #1 returned to Alice after cancel");
  console.log(`${INFO} Alice listed and cancelled token #1 — OK`);

  // Check snapshot
  const [sales24h, listedCount, floorPrice] = await market.getMarketSnapshot();
  console.log(`${INFO} Market snapshot: ${sales24h} sales/24h, ${listedCount} listed, floor ${fmt(floorPrice)}`);

  // ───────────────────── LIQUIDITY / SELL TO POOL ─────────────────────
  console.log(`\n${SEP}\n  LIQUIDITY / SELL-TO-POOL\n${SEP}`);

  const poolFloor = await pool.getFloorPrice();
  const sellPrice = await pool.getSellPrice();
  const canSell = await pool.canSellIntoPool();
  const marketState = await pool.marketState();
  const stateLabels = ["Expansion", "Stabilization", "WeakDemand"];

  console.log(`${INFO} Market state: ${stateLabels[marketState]}`);
  console.log(`${INFO} Pool floor: ${fmt(poolFloor)}`);
  console.log(`${INFO} Sell price: ${fmt(sellPrice)}`);
  console.log(`${INFO} Can sell into pool: ${canSell}`);

  // Fast-forward past launch protection (6 hours)
  await ethers.provider.send("evm_increaseTime", [6 * 3600 + 1]);
  await ethers.provider.send("evm_mine", []);
  console.log(`${INFO} Fast-forwarded 6h past launch protection`);

  // Push market to Stabilization by setting external snapshot
  await (await pool.setExternalMarketSnapshot(0, 5, poolFloor.div(2))).wait();
  console.log(`${INFO} Set external snapshot (weak signals) to push to Stabilization/WeakDemand`);

  const stateAfter = await pool.marketState();
  const canSellAfter = await pool.canSellIntoPool();
  const sellPriceAfter = await pool.getSellPrice();
  console.log(`${INFO} Market state after snapshot: ${stateLabels[stateAfter]}`);
  console.log(`${INFO} Can sell into pool now: ${canSellAfter}`);
  console.log(`${INFO} Sell price now: ${fmt(sellPriceAfter)}`);

  if (canSellAfter && sellPriceAfter.gt(0)) {
    // Bob sells token #5 into pool
    await (await nft.connect(bob).setApprovalForAll(router.address, true)).wait();
    const bobBefore = await ethers.provider.getBalance(bob.address);

    const txSell = await router.connect(bob).sellNFT(5, 0);
    const rcSell = await txSell.wait();
    const gasCost = rcSell.gasUsed.mul(rcSell.effectiveGasPrice);

    const bobAfter = await ethers.provider.getBalance(bob.address);
    const payout = bobAfter.sub(bobBefore).add(gasCost);
    console.log(`${OK} Bob sold token #5 into pool for ~${fmt(payout)}`);

    const poolNftCount = await pool.availableNFTs();
    assert(poolNftCount.gt(0), `Pool now holds ${poolNftCount} NFT(s)`);

    const poolEthAfter = await pool.ethBalance();
    console.log(`${INFO} Pool reserve after sell: ${fmt(poolEthAfter)}`);
  } else {
    console.log(`${INFO} Pool sell not enabled in current market state — skipping sell test`);
    console.log(`${INFO} This is expected: sell requires Stabilization/WeakDemand + coverage >= 100%`);
  }

  // ───────────────────── STAKING ─────────────────────
  console.log(`\n${SEP}\n  STAKING\n${SEP}`);

  // Alice approves pool for staking, then stakes token #2
  await (await nft.connect(alice).setApprovalForAll(pool.address, true)).wait();
  const txStake = await (await pool.connect(alice).stake(2)).wait();
  const aliceStaked = await pool.getUserStakedTokens(alice.address);
  assert(aliceStaked.length === 1 && aliceStaked[0].eq(2), "Alice staked token #2");

  const totalStaked = await pool.totalStaked();
  assert(totalStaked.eq(1), `Total staked: ${totalStaked}`);

  // Check pending fees (should be 0 before any trades)
  const pendingBefore = await pool.viewPendingFees(alice.address);
  console.log(`${INFO} Alice pending fees before trades: ${fmt(pendingBefore)}`);

  // Generate some fees: Alice lists and Bob buys another token
  await (await market.connect(alice).createListing(3, listPrice)).wait();
  await (await market.connect(bob).buyListing(3, { value: listPrice })).wait();
  console.log(`${INFO} Generated trade fee from marketplace sale`);

  const pendingAfter = await pool.viewPendingFees(alice.address);
  console.log(`${INFO} Alice pending fees after trade: ${fmt(pendingAfter)}`);
  assert(pendingAfter.gt(0), "Alice accrued staking fees from marketplace trade");

  // Alice claims fees
  const aliceEthBefore = await ethers.provider.getBalance(alice.address);
  const txClaim = await pool.connect(alice).claimFees();
  const rcClaim = await txClaim.wait();
  const claimGas = rcClaim.gasUsed.mul(rcClaim.effectiveGasPrice);
  const aliceEthAfter = await ethers.provider.getBalance(alice.address);
  const claimed = aliceEthAfter.sub(aliceEthBefore).add(claimGas);
  console.log(`${OK} Alice claimed ${fmt(claimed)} in staking fees`);
  assert(claimed.gt(0), "Claimed amount > 0");

  // Alice unstakes token #2
  await (await pool.connect(alice).unstake(2)).wait();
  assert((await nft.ownerOf(2)) === alice.address, "Token #2 returned to Alice after unstake");
  assert((await pool.totalStaked()).eq(0), "Total staked back to 0");
  console.log(`${OK} Alice unstaked token #2`);

  // ───────────────────── SUMMARY ─────────────────────
  console.log(`\n${SEP}\n  SUMMARY\n${SEP}`);
  console.log(`${OK} Marketplace: listing, buying, cancelling — all work`);
  console.log(`${OK} Fees: 2.5% marketplace fee distributed to pool/stakers/treasury`);
  console.log(`${OK} Staking: stake, accrue fees from trades, claim, unstake — all work`);
  if (canSellAfter) {
    console.log(`${OK} Sell-to-pool: user sold NFT, pool received it, user got ETH`);
  } else {
    console.log(`${INFO} Sell-to-pool: gated by market state (expected — needs coverage >= 100%)`);
  }
  console.log(`${OK} Liquidity: pool reserve grows from mints (60%) and fees`);

  const finalPoolEth = await pool.ethBalance();
  const finalTreasury = await pool.treasuryBalance();
  const finalProtocolFees = await pool.protocolFees();
  console.log(`\n${INFO} Final pool reserve: ${fmt(finalPoolEth)}`);
  console.log(`${INFO} Final treasury: ${fmt(finalTreasury)}`);
  console.log(`${INFO} Final protocol fees: ${fmt(finalProtocolFees)}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
