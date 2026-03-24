const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const TRADE_FEE_BPS = 250;
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

async function seedPoolReserve(pool, owner, routerAddress, amount) {
  await (await pool.connect(owner).setRouter(owner.address)).wait();
  await (await pool.connect(owner).seedLiquidity({ value: amount })).wait();
  await (await pool.connect(owner).setRouter(routerAddress)).wait();
}

function addBps(value, bps) {
  return value.add(value.mul(bps).div(BPS));
}

async function expectCustomError(promise, errorName) {
  await assert.rejects(promise, new RegExp(errorName));
}

describe("PixelPool + PixelRouter smoke suite", function () {
  it("wires router minter, pool burner, and keeps public mint disabled by default", async function () {
    const { user, nft, pool, router, mintPrice } = await deployStack();

    assert.strictEqual(await nft.isMinter(router.address), true);
    assert.strictEqual(await nft.isBurner(pool.address), true);
    assert.strictEqual(await nft.publicMintEnabled(), false);

    await expectCustomError(
      nft.connect(user)["mint(bytes)"](onePixel(), { value: mintPrice }),
      "PublicMintDisabled"
    );
  });

  it("mints through router and splits reserve balances into pool and treasury", async function () {
    const { user, nft, pool, router, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(), { value: mintPrice })).wait();

    assert.strictEqual(await nft.ownerOf(0), user.address);
    assert.strictEqual((await pool.ethBalance()).toString(), mintPrice.mul(POOL_SEED_BPS).div(BPS).toString());
    assert.strictEqual((await pool.treasuryBalance()).toString(), mintPrice.mul(TREASURY_BPS).div(BPS).toString());
    assert.strictEqual((await pool.totalMinted()).toString(), "1");
    assert.strictEqual((await nft.totalSupply()).toString(), "1");
  });

  it("requires exact router mint payment", async function () {
    const { user, router, mintPrice } = await deployStack();

    await expectCustomError(
      router.connect(user)["mint(bytes)"](onePixel(), { value: mintPrice.sub(1) }),
      "IncorrectPayment"
    );

    await expectCustomError(
      router.connect(user)["mint(bytes)"](onePixel(), { value: mintPrice.add(1) }),
      "IncorrectPayment"
    );
  });

  it("supports sell into pool and later buySpecific after market windows reset", async function () {
    const { owner, user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));

    await increaseTime(LAUNCH_PROTECTION + 1);

    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();

    assert.strictEqual(await nft.ownerOf(0), pool.address);
    assert.strictEqual((await pool.availableNFTs()).toString(), "1");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "1");
    assert.strictEqual((await pool.marketState()).toString(), "2");

    await increaseTime(LONG_WINDOW + 1);

    const floor = await pool.getFloorPrice();
    const ask = addBps(floor, STABILIZATION_SPREAD_BPS);
    const cost = addBps(ask, TRADE_FEE_BPS);

    await (await router.connect(buyer).buySpecificNFT(0, cost, { value: cost })).wait();

    assert.strictEqual(await nft.ownerOf(0), buyer.address);
    assert.strictEqual((await pool.availableNFTs()).toString(), "0");
    assert.strictEqual((await pool.totalSoldIntoPool()).toString(), "0");
  });
});
