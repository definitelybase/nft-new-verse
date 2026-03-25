const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
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

async function expectCustomError(promise, errorName) {
  await assert.rejects(promise, new RegExp(errorName));
}

async function deployFactoryStack() {
  const [deployer, creator, buyer, nextBuyer] = await ethers.getSigners();
  const mintPrice = ethers.utils.parseEther("0.01");

  const Factory = await ethers.getContractFactory("PixelFactory");
  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const Pool = await ethers.getContractFactory("PixelPool");
  const Router = await ethers.getContractFactory("PixelRouter");

  const factory = await Factory.connect(deployer).deploy();
  await factory.deployed();

  await (await factory.connect(deployer).setNFTCode(NFT.bytecode)).wait();
  await (await factory.connect(deployer).setPoolCode(Pool.bytecode)).wait();
  await (await factory.connect(deployer).setRouterCode(Router.bytecode)).wait();

  return { deployer, creator, buyer, nextBuyer, factory, NFT, Pool, Router, mintPrice };
}

async function createCollection(env) {
  const { creator, factory, NFT, Pool, Router, mintPrice } = env;

  const tx = await factory.connect(creator).createCollection(
    "FactoryPixels",
    "FPXL",
    4,
    1,
    1,
    1000,
    mintPrice,
    POOL_SEED_BPS,
    TREASURY_BPS,
    palette16()
  );
  const receipt = await tx.wait();
  const event = receipt.events.find((entry) => entry.event === "CollectionCreated");

  const nft = NFT.attach(event.args.nft);
  const pool = Pool.attach(event.args.pool);
  const router = Router.attach(event.args.router);

  return { nft, pool, router, event };
}

async function seedPoolReserve(pool, creator, routerAddress, amount) {
  await (await pool.connect(creator).setRouter(creator.address)).wait();
  await (await pool.connect(creator).seedLiquidity({ value: amount })).wait();
  await (await pool.connect(creator).setRouter(routerAddress)).wait();
}

async function setStabilizationSnapshot(pool, creator) {
  const floor = await pool.getFloorPrice();
  await (await pool.connect(creator).setExternalMarketSnapshot(2, 120, floor)).wait();
}

describe("PixelFactory end-to-end", function () {
  it("creates a fully wired collection stack and routes mint through router", async function () {
    const env = await deployFactoryStack();
    const { creator, buyer, factory, mintPrice } = env;
    const { nft, pool, router, event } = await createCollection(env);

    assert.strictEqual((await factory.totalCollections()).toString(), "1");

    const collection = await factory.getCollection(0);
    assert.strictEqual(collection.nft, event.args.nft);
    assert.strictEqual(collection.pool, event.args.pool);
    assert.strictEqual(collection.router, event.args.router);
    assert.strictEqual(collection.creator, creator.address);

    assert.strictEqual(await nft.owner(), creator.address);
    assert.strictEqual(await pool.owner(), creator.address);
    assert.strictEqual(await router.owner(), creator.address);
    assert.strictEqual(await nft.isMinter(router.address), true);
    assert.strictEqual(await nft.isBurner(pool.address), true);
    assert.strictEqual(await pool.router(), router.address);
    assert.strictEqual(await pool.listingVault(), creator.address);

    await expectCustomError(
      nft.connect(buyer)["mint(bytes)"](onePixel(), { value: mintPrice }),
      "PublicMintDisabled"
    );

    await (await router.connect(buyer)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();

    assert.strictEqual(await nft.ownerOf(0), buyer.address);
    assert.strictEqual((await pool.ethBalance()).toString(), mintPrice.mul(POOL_SEED_BPS).div(BPS).toString());
    assert.strictEqual((await pool.treasuryBalance()).toString(), mintPrice.mul(TREASURY_BPS).div(BPS).toString());
    assert.strictEqual((await pool.totalMinted()).toString(), "1");
  });

  it("supports sell and later releases inventory to the creator listing vault", async function () {
    const env = await deployFactoryStack();
    const { creator, buyer, mintPrice } = env;
    const { nft, pool, router } = await createCollection(env);

    await (await router.connect(buyer)["mint(bytes)"](onePixel(3), { value: mintPrice })).wait();
    await seedPoolReserve(pool, creator, router.address, ethers.utils.parseEther("6"));

    await increaseTime(LAUNCH_PROTECTION + 1);

    await (await nft.connect(buyer).approve(router.address, 0)).wait();
    await (await router.connect(buyer).sellNFT(0, 0)).wait();

    assert.strictEqual(await nft.ownerOf(0), pool.address);
    assert.strictEqual((await pool.availableNFTs()).toString(), "1");

    await setStabilizationSnapshot(pool, creator);
    await (await pool.connect(creator).releasePoolInventoryForListing(1)).wait();

    assert.strictEqual(await nft.ownerOf(0), creator.address);
    assert.strictEqual((await pool.availableNFTs()).toString(), "0");
  });
});
