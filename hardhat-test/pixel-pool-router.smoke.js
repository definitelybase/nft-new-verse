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
  it("rejects invalid pool constructor arguments", async function () {
    const [owner] = await ethers.getSigners();
    const mintPrice = ethers.utils.parseEther("0.01");
    const Pool = await ethers.getContractFactory("PixelPool");

    await expectCustomError(
      Pool.deploy(ethers.constants.AddressZero, mintPrice),
      "ZeroAddress"
    );

    await expectCustomError(
      Pool.deploy(owner.address, 0),
      "InvalidAmount"
    );
  });

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

  it("keeps totalMinted monotonic when updated by the router", async function () {
    const { owner, pool } = await deployStack();

    await (await pool.connect(owner).setRouter(owner.address)).wait();
    await (await pool.connect(owner).setTotalMinted(3)).wait();
    assert.strictEqual((await pool.totalMinted()).toString(), "3");

    await expectCustomError(
      pool.connect(owner).setTotalMinted(2),
      "InvalidAmount"
    );
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

  it("rescueNFT lets owner recover an NFT stuck in the router", async function () {
    const { owner, user, nft, router, mintPrice } = await deployStack();

    // Mint an NFT to user, then transfer it into the router (simulating a stuck state)
    await (await router.connect(user)["mint(bytes)"](onePixel(), { value: mintPrice })).wait();
    assert.strictEqual(await nft.ownerOf(0), user.address);

    await (await nft.connect(user).transferFrom(user.address, router.address, 0)).wait();
    assert.strictEqual(await nft.ownerOf(0), router.address);

    // Non-owner cannot rescue
    await expectCustomError(
      router.connect(user).rescueNFT(0, user.address),
      "Ownable: caller is not the owner"
    );

    // Owner rescues NFT back to user
    await (await router.connect(owner).rescueNFT(0, user.address)).wait();
    assert.strictEqual(await nft.ownerOf(0), user.address);
  });

  it("rescueETH lets owner recover ETH stuck in the router", async function () {
    const { owner, user, router } = await deployStack();

    // Send ETH directly to router (simulating stuck funds)
    await (await user.sendTransaction({ to: router.address, value: ethers.utils.parseEther("0.5") })).wait();
    const routerBal = await ethers.provider.getBalance(router.address);
    assert.ok(routerBal.gt(0));

    // Non-owner cannot rescue
    await expectCustomError(
      router.connect(user).rescueETH(user.address),
      "Ownable: caller is not the owner"
    );

    // Owner rescues ETH
    const balBefore = await ethers.provider.getBalance(user.address);
    await (await router.connect(owner).rescueETH(user.address)).wait();
    const balAfter = await ethers.provider.getBalance(user.address);

    assert.ok(balAfter.gt(balBefore));
    assert.strictEqual((await ethers.provider.getBalance(router.address)).toString(), "0");

    // Reverts when no ETH to rescue
    await expectCustomError(
      router.connect(owner).rescueETH(user.address),
      "TransferFailed"
    );
  });

  it("rejects zero-address admin and rescue targets", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await expectCustomError(
      router.connect(owner).setCreator(ethers.constants.AddressZero),
      "ZeroAddress"
    );

    await expectCustomError(
      pool.connect(owner).setRouter(ethers.constants.AddressZero),
      "ZeroAddress"
    );

    await expectCustomError(
      nft.connect(owner).setMinter(ethers.constants.AddressZero, true),
      "ZeroAddress"
    );

    await expectCustomError(
      nft.connect(owner).setBurner(ethers.constants.AddressZero, true),
      "ZeroAddress"
    );

    await expectCustomError(
      router.connect(owner).rescueETH(ethers.constants.AddressZero),
      "ZeroAddress"
    );

    await (await router.connect(user)["mint(bytes)"](onePixel(), { value: mintPrice })).wait();
    await (await nft.connect(user).transferFrom(user.address, router.address, 0)).wait();

    await expectCustomError(
      router.connect(owner).rescueNFT(0, ethers.constants.AddressZero),
      "ZeroAddress"
    );
  });

  it("rejects zero-address router constructor arguments", async function () {
    const [_, creator] = await ethers.getSigners();
    const mintPrice = ethers.utils.parseEther("0.01");
    const Router = await ethers.getContractFactory("PixelRouter");

    await expectCustomError(
      Router.deploy(
        ethers.constants.AddressZero,
        creator.address,
        creator.address,
        mintPrice,
        POOL_SEED_BPS,
        TREASURY_BPS
      ),
      "ZeroAddress"
    );

    await expectCustomError(
      Router.deploy(
        creator.address,
        ethers.constants.AddressZero,
        creator.address,
        mintPrice,
        POOL_SEED_BPS,
        TREASURY_BPS
      ),
      "ZeroAddress"
    );

    await expectCustomError(
      Router.deploy(
        creator.address,
        creator.address,
        ethers.constants.AddressZero,
        mintPrice,
        POOL_SEED_BPS,
        TREASURY_BPS
      ),
      "ZeroAddress"
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

  it("refunds router buy overpayment back to the buyer instead of trapping ETH in the router", async function () {
    const { owner, user, buyer, nft, pool, router, mintPrice } = await deployStack();

    await (await router.connect(user)["mint(bytes)"](onePixel(2), { value: mintPrice })).wait();
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));

    await increaseTime(LAUNCH_PROTECTION + 1);

    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();

    await increaseTime(LONG_WINDOW + 1);

    const floor = await pool.getFloorPrice();
    const ask = addBps(floor, STABILIZATION_SPREAD_BPS);
    const cost = addBps(ask, TRADE_FEE_BPS);
    const overpay = addBps(cost, 100);

    await (await router.connect(buyer).buySpecificNFT(0, overpay, { value: overpay })).wait();

    assert.strictEqual(await nft.ownerOf(0), buyer.address);
    assert.strictEqual((await ethers.provider.getBalance(router.address)).toString(), "0");
  });
});
