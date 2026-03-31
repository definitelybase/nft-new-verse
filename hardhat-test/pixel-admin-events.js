const assert = require("assert");
const { ethers } = require("hardhat");

const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const ROUTER_CHANGE_DELAY = 48 * 60 * 60;

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

function getEvent(receipt, name) {
  const event = receipt.events.find((entry) => entry.event === name);
  assert.ok(event, `Missing event ${name}`);
  return event;
}

function getParsedLog(receipt, contract, name) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed.name === name) return parsed;
    } catch (_) {
      // ignore logs from other contracts
    }
  }
  assert.fail(`Missing event ${name}`);
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

async function deployStack() {
  const [owner, creator, user, other] = await ethers.getSigners();
  const mintPrice = ethers.utils.parseEther("0.01");

  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy("Dwellers", "OCPX", 4, 1, 1, 1000, mintPrice, palette16());
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

  return { owner, creator, user, other, nft, pool, router, mintPrice };
}

describe("Admin and emergency events", function () {
  it("emits mint-side accounting events across router and pool", async function () {
    const { user, pool, router, mintPrice } = await deployStack();

    const receipt = await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();

    const routerMinted = getEvent(receipt, "Minted");
    const liquidityAdded = getParsedLog(receipt, pool, "LiquidityAdded");
    const treasurySeeded = getParsedLog(receipt, pool, "TreasurySeeded");
    const totalMintedUpdated = getParsedLog(receipt, pool, "TotalMintedUpdated");

    assert.strictEqual(routerMinted.args.minter, user.address);
    assert.strictEqual(routerMinted.args.tokenId.toString(), "0");
    assert.strictEqual(routerMinted.args.mintPrice.toString(), mintPrice.toString());
    assert.strictEqual(routerMinted.args.poolSeed.toString(), mintPrice.mul(POOL_SEED_BPS).div(10000).toString());

    assert.strictEqual(liquidityAdded.args.ethAmount.toString(), mintPrice.mul(POOL_SEED_BPS).div(10000).toString());
    assert.strictEqual(treasurySeeded.args.ethAmount.toString(), mintPrice.mul(TREASURY_BPS).div(10000).toString());
    assert.strictEqual(totalMintedUpdated.args.previousTotalMinted.toString(), "0");
    assert.strictEqual(totalMintedUpdated.args.newTotalMinted.toString(), "1");
    assert.strictEqual((await pool.totalMinted()).toString(), "1");
  });

  it("emits router and pool admin/emergency events", async function () {
    const { owner, creator, user, other, nft, pool, router, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();

    let receipt = await (await router.connect(owner).setMintPrice(ethers.utils.parseEther("0.02"))).wait();
    let event = getEvent(receipt, "MintPriceUpdated");
    assert.strictEqual(event.args.previousPrice.toString(), mintPrice.toString());

    receipt = await (await router.connect(owner).setCreator(other.address)).wait();
    event = getEvent(receipt, "CreatorUpdated");
    assert.strictEqual(event.args.previousCreator, creator.address);
    assert.strictEqual(event.args.newCreator, other.address);

    receipt = await (await router.connect(owner).setPoolSeedBps(5500)).wait();
    event = getEvent(receipt, "PoolSeedBpsUpdated");
    assert.strictEqual(event.args.previousBps.toString(), "6000");
    assert.strictEqual(event.args.newBps.toString(), "5500");

    receipt = await (await router.connect(owner).setTreasuryBps(1500)).wait();
    event = getEvent(receipt, "TreasuryBpsUpdated");
    assert.strictEqual(event.args.previousBps.toString(), "1000");
    assert.strictEqual(event.args.newBps.toString(), "1500");

    await increaseTime(LAUNCH_PROTECTION + 1);

    receipt = await (await pool.connect(owner).setRouter(other.address)).wait();
    event = getEvent(receipt, "RouterChangeQueued");
    assert.strictEqual(event.args.currentRouter, router.address);
    assert.strictEqual(event.args.pendingRouter, other.address);

    await assert.rejects(
      pool.connect(owner).applyRouterUpdate(),
      /RouterChangeNotReady/
    );

    receipt = await (await pool.connect(owner).cancelRouterUpdate()).wait();
    event = getEvent(receipt, "RouterChangeCancelled");
    assert.strictEqual(event.args.pendingRouter, other.address);

    receipt = await (await pool.connect(owner).setRouter(owner.address)).wait();
    event = getEvent(receipt, "RouterChangeQueued");
    assert.strictEqual(event.args.currentRouter, router.address);
    assert.strictEqual(event.args.pendingRouter, owner.address);

    await increaseTime(ROUTER_CHANGE_DELAY + 1);

    receipt = await (await pool.connect(owner).applyRouterUpdate()).wait();
    event = getEvent(receipt, "RouterUpdated");
    assert.strictEqual(event.args.previousRouter, router.address);
    assert.strictEqual(event.args.newRouter, owner.address);

    await (await nft.connect(user).transferFrom(user.address, router.address, 0)).wait();

    receipt = await (await router.connect(owner).rescueNFT(0, user.address)).wait();
    event = getEvent(receipt, "NFTRescued");
    assert.strictEqual(event.args.tokenId.toString(), "0");
    assert.strictEqual(event.args.to, user.address);

    await owner.sendTransaction({ to: router.address, value: ethers.utils.parseEther("0.5") });
    receipt = await (await router.connect(owner).rescueETH(owner.address)).wait();
    event = getEvent(receipt, "ETHRescued");
    assert.strictEqual(event.args.to, owner.address);
    assert.strictEqual(event.args.amount.toString(), ethers.utils.parseEther("0.5").toString());
  });

  it("emits factory setup/admin events", async function () {
    const [owner] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PixelFactory");
    const factory = await Factory.connect(owner).deploy();
    await factory.deployed();

    const dummyNFTCode = "0x60016000";
    const dummyPoolCode = "0x60026000";
    const dummyRouterCode = "0x60036000";
    const dummyMarketCode = "0x60046000";

    let receipt = await (await factory.connect(owner).setNFTCode(dummyNFTCode)).wait();
    getEvent(receipt, "NFTCodeUpdated");

    receipt = await (await factory.connect(owner).setPoolCode(dummyPoolCode)).wait();
    getEvent(receipt, "PoolCodeUpdated");

    receipt = await (await factory.connect(owner).setRouterCode(dummyRouterCode)).wait();
    getEvent(receipt, "RouterCodeUpdated");

    receipt = await (await factory.connect(owner).setMarketplaceCode(dummyMarketCode)).wait();
    getEvent(receipt, "MarketplaceCodeUpdated");

    receipt = await (await factory.connect(owner).setFactoryFee(ethers.utils.parseEther("0.1"))).wait();
    let event = getEvent(receipt, "FactoryFeeUpdated");
    assert.strictEqual(event.args.previousFee.toString(), "0");
    assert.strictEqual(event.args.newFee.toString(), ethers.utils.parseEther("0.1").toString());
  });
});
