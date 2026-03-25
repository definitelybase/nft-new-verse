const assert = require("assert");
const { ethers } = require("hardhat");

const BPS = 10000;
const POOL_SEED_BPS = 6000;
const TREASURY_BPS = 1000;
const TRADE_FEE_BPS = 250;
const STABILIZATION_SPREAD_BPS = 2000;
const LAUNCH_PROTECTION = 6 * 60 * 60;
const LONG_WINDOW = 24 * 60 * 60;
const MARKET_STATE_SLOT = 24;
const slotCache = {};

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

function addBps(value, bps) {
  return value.add(value.mul(bps).div(BPS));
}

function getEvent(receipt, name) {
  const event = receipt.events.find((entry) => entry.event === name);
  assert.ok(event, `Missing event ${name}`);
  return event;
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

async function expectCustomError(promise, errorName) {
  await assert.rejects(promise, new RegExp(errorName));
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
  await (await pool.connect(owner).setListingVault(owner.address)).wait();

  return { owner, creator, user, buyer, nft, pool, router, mintPrice };
}

async function mintOne(router, user, mintPrice, colorIndex = 1) {
  await (await router.connect(user)["mint(bytes)"](onePixel(colorIndex), { value: mintPrice })).wait();
}

async function seedPoolReserve(pool, owner, routerAddress, amount) {
  await (await pool.connect(owner).setRouter(owner.address)).wait();
  await (await pool.connect(owner).seedLiquidity({ value: amount })).wait();
  await (await pool.connect(owner).setRouter(routerAddress)).wait();
}

function slotCacheKey(contract, getterName) {
  return `${contract.address}:${getterName}`;
}

async function findStorageSlot(contract, getterName, probeValue) {
  const key = slotCacheKey(contract, getterName);
  if (slotCache[key] !== undefined) return slotCache[key];

  for (let candidate = 0; candidate < 80; candidate++) {
    const slot = slotHex(candidate);
    const original = await ethers.provider.getStorageAt(contract.address, slot);

    await ethers.provider.send("hardhat_setStorageAt", [contract.address, slot, valueHex(probeValue)]);
    await ethers.provider.send("evm_mine", []);

    const current = await contract[getterName]();
    const matches = ethers.BigNumber.isBigNumber(current)
      ? current.eq(probeValue)
      : Number(current) === Number(probeValue);

    await ethers.provider.send("hardhat_setStorageAt", [contract.address, slot, original]);
    await ethers.provider.send("evm_mine", []);

    if (matches) {
      slotCache[key] = candidate;
      return candidate;
    }
  }

  throw new Error(`Unable to locate storage slot for ${getterName}`);
}

async function setUintVar(contract, getterName, value, probeValue = 987654321) {
  const slot = await findStorageSlot(contract, getterName, probeValue);
  await ethers.provider.send("hardhat_setStorageAt", [
    contract.address,
    slotHex(slot),
    valueHex(value),
  ]);
  await ethers.provider.send("evm_mine", []);
}

async function forceMarketState(pool, value) {
  await ethers.provider.send("hardhat_setStorageAt", [
    pool.address,
    slotHex(MARKET_STATE_SLOT),
    valueHex(value),
  ]);
  await ethers.provider.send("evm_mine", []);
}

async function deployFactoryStack() {
  const [deployer, creator] = await ethers.getSigners();
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

  return { deployer, creator, factory, mintPrice };
}

describe("Protocol fee and admin invariants", function () {
  it("lets only the owner claim protocol fees and drains the exact accrued amount", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();

    const accrued = await pool.protocolFees();
    assert.ok(accrued.gt(0), "protocolFees should accrue from sell trades");

    await expectCustomError(
      pool.connect(user).claimProtocolFees(),
      "Ownable: caller is not the owner"
    );

    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await pool.connect(owner).claimProtocolFees();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const balanceAfter = await ethers.provider.getBalance(owner.address);

    const event = getEvent(receipt, "ProtocolFeesClaimed");
    assert.strictEqual(event.args.to, owner.address);
    assert.strictEqual(event.args.amount.toString(), accrued.toString());
    assert.strictEqual(balanceAfter.add(gasUsed).sub(balanceBefore).toString(), accrued.toString());
    assert.strictEqual((await pool.protocolFees()).toString(), "0");

    await expectCustomError(
      pool.connect(owner).claimProtocolFees(),
      "NothingToClaim"
    );
  });

  it("pause blocks trade and listing-release paths, then unpause restores them", async function () {
    const { owner, user, nft, pool, router, mintPrice } = await deployStack();

    await mintOne(router, user, mintPrice, 1);
    await seedPoolReserve(pool, owner, router.address, ethers.utils.parseEther("5"));
    await increaseTime(LAUNCH_PROTECTION + 1);

    await assert.rejects(
      pool.connect(user).pause(),
      /Ownable: caller is not the owner/
    );

    await (await nft.connect(user).approve(router.address, 0)).wait();
    await (await pool.connect(owner).pause()).wait();

    await assert.rejects(
      router.connect(user).sellNFT(0, 0),
      /paused/
    );

    await (await pool.connect(owner).unpause()).wait();
    await (await router.connect(user).sellNFT(0, 0)).wait();
    assert.strictEqual(await nft.ownerOf(0), pool.address);

    await increaseTime(LONG_WINDOW + 1);
    await forceMarketState(pool, 1);
    assert.strictEqual(await pool.canReleaseInventoryForListing(), true);

    await (await pool.connect(owner).pause()).wait();
    await assert.rejects(
      pool.connect(owner).releasePoolInventoryForListing(1),
      /paused/
    );

    await (await pool.connect(owner).unpause()).wait();
    await (await pool.connect(owner).releasePoolInventoryForListing(1)).wait();
    assert.strictEqual(await nft.ownerOf(0), owner.address);
  });

  it("enforces factory fees and lets only owner withdraw them", async function () {
    const { deployer, creator, factory, mintPrice } = await deployFactoryStack();
    const fee = ethers.utils.parseEther("0.1");

    await assert.rejects(
      factory.connect(creator).setFactoryFee(fee),
      /Ownable: caller is not the owner/
    );

    let receipt = await (await factory.connect(deployer).setFactoryFee(fee)).wait();
    let event = getEvent(receipt, "FactoryFeeUpdated");
    assert.strictEqual(event.args.previousFee.toString(), "0");
    assert.strictEqual(event.args.newFee.toString(), fee.toString());

    await expectCustomError(
      factory.connect(creator).createCollection(
        "FactoryPixels",
        "FPXL",
        4,
        1,
        1,
        1000,
        mintPrice,
        POOL_SEED_BPS,
        TREASURY_BPS,
        palette16(),
        { value: fee.sub(1) }
      ),
      "InsufficientFee"
    );

    await (await factory.connect(creator).createCollection(
      "FactoryPixels",
      "FPXL",
      4,
      1,
      1,
      1000,
      mintPrice,
      POOL_SEED_BPS,
      TREASURY_BPS,
      palette16(),
      { value: fee }
    )).wait();

    assert.strictEqual((await ethers.provider.getBalance(factory.address)).toString(), fee.toString());

    await assert.rejects(
      factory.connect(creator).withdraw(),
      /Ownable: caller is not the owner/
    );

    const balanceBefore = await ethers.provider.getBalance(deployer.address);
    const tx = await factory.connect(deployer).withdraw();
    receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const balanceAfter = await ethers.provider.getBalance(deployer.address);

    event = getEvent(receipt, "FactoryWithdrawn");
    assert.strictEqual(event.args.to, deployer.address);
    assert.strictEqual(event.args.amount.toString(), fee.toString());
    assert.strictEqual(balanceAfter.add(gasUsed).sub(balanceBefore).toString(), fee.toString());
    assert.strictEqual((await ethers.provider.getBalance(factory.address)).toString(), "0");
  });
});
