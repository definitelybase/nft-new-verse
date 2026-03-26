const assert = require("assert");
const { ethers } = require("hardhat");

function palette16() {
  return ethers.utils.hexlify([
    0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
    0xff, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff,
    0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x80, 0x80, 0x00,
    0x80, 0x00, 0x80, 0x00, 0x80, 0x80, 0x80, 0x80, 0x80, 0xc0, 0xc0, 0xc0
  ]);
}

function alternatePalette16() {
  return ethers.utils.hexlify([
    0xff, 0xff, 0xff, 0x11, 0x11, 0x11, 0xff, 0x88, 0x00, 0x33, 0xcc, 0x66,
    0x44, 0x88, 0xff, 0xff, 0xdd, 0x55, 0xee, 0x66, 0xcc, 0x55, 0xee, 0xff,
    0xaa, 0x44, 0x44, 0x44, 0xaa, 0x44, 0x44, 0x44, 0xaa, 0xaa, 0xaa, 0x44,
    0xaa, 0x44, 0xaa, 0x44, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xdd, 0xdd, 0xdd
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

async function expectCustomError(promise, errorName) {
  await assert.rejects(promise, new RegExp(errorName));
}

describe("Factory and NFT admin paths", function () {
  it("restricts factory admin setters and withdraw to the owner", async function () {
    const [owner, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PixelFactory");
    const factory = await Factory.connect(owner).deploy();
    await factory.deployed();

    const dummyNFTCode = "0x60016000";
    const dummyPoolCode = "0x60026000";
    const dummyRouterCode = "0x60036000";
    const dummyMarketCode = "0x60046000";
    const fee = ethers.utils.parseEther("0.25");

    await assert.rejects(
      factory.connect(user).setNFTCode(dummyNFTCode),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      factory.connect(user).setPoolCode(dummyPoolCode),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      factory.connect(user).setRouterCode(dummyRouterCode),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      factory.connect(user).setMarketplaceCode(dummyMarketCode),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      factory.connect(user).setFactoryFee(fee),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      factory.connect(user).withdraw(),
      /Ownable: caller is not the owner/
    );

    await (await factory.connect(owner).setNFTCode(dummyNFTCode)).wait();
    await (await factory.connect(owner).setPoolCode(dummyPoolCode)).wait();
    await (await factory.connect(owner).setRouterCode(dummyRouterCode)).wait();
    await (await factory.connect(owner).setMarketplaceCode(dummyMarketCode)).wait();
    assert.strictEqual(await factory.nftCode(), dummyNFTCode);
    assert.strictEqual(await factory.poolCode(), dummyPoolCode);
    assert.strictEqual(await factory.routerCode(), dummyRouterCode);
    assert.strictEqual(await factory.marketCode(), dummyMarketCode);

    const feeReceipt = await (await factory.connect(owner).setFactoryFee(fee)).wait();
    const feeEvent = getEvent(feeReceipt, "FactoryFeeUpdated");
    assert.strictEqual(feeEvent.args.previousFee.toString(), "0");
    assert.strictEqual(feeEvent.args.newFee.toString(), fee.toString());
    assert.strictEqual((await factory.factoryFee()).toString(), fee.toString());

    await ethers.provider.send("hardhat_setBalance", [
      factory.address,
      fee.toHexString()
    ]);

    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await factory.connect(owner).withdraw();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const balanceAfter = await ethers.provider.getBalance(owner.address);
    const withdrawEvent = getEvent(receipt, "FactoryWithdrawn");

    assert.strictEqual(withdrawEvent.args.to, owner.address);
    assert.strictEqual(withdrawEvent.args.amount.toString(), fee.toString());
    assert.strictEqual(balanceAfter.add(gasUsed).sub(balanceBefore).toString(), fee.toString());
    assert.strictEqual((await ethers.provider.getBalance(factory.address)).toString(), "0");
  });

  it("restricts NFT admin setters to owner and supports owner withdrawal of mint proceeds", async function () {
    const [owner, user, helper] = await ethers.getSigners();
    const mintPrice = ethers.utils.parseEther("0.01");
    const newMintPrice = ethers.utils.parseEther("0.02");

    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const nft = await NFT.connect(owner).deploy(
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

    await assert.rejects(
      nft.connect(user).setMinter(helper.address, true),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      nft.connect(user).setBurner(helper.address, true),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      nft.connect(user).setPalette(alternatePalette16()),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      nft.connect(user).lockPalette(),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      nft.connect(user).setMintPrice(newMintPrice),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      nft.connect(user).setPublicMintEnabled(true),
      /Ownable: caller is not the owner/
    );
    await assert.rejects(
      nft.connect(user).withdraw(),
      /Ownable: caller is not the owner/
    );

    await (await nft.connect(owner).setMinter(helper.address, true)).wait();
    await (await nft.connect(owner).setBurner(helper.address, true)).wait();
    await (await nft.connect(owner).setMintPrice(newMintPrice)).wait();
    await (await nft.connect(owner).setPublicMintEnabled(true)).wait();

    assert.strictEqual(await nft.isMinter(helper.address), true);
    assert.strictEqual(await nft.isBurner(helper.address), true);
    assert.strictEqual((await nft.mintPrice()).toString(), newMintPrice.toString());
    assert.strictEqual(await nft.publicMintEnabled(), true);

    await (await nft.connect(user)["mint(bytes)"](onePixel(), { value: newMintPrice })).wait();
    assert.strictEqual((await ethers.provider.getBalance(nft.address)).toString(), newMintPrice.toString());

    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await nft.connect(owner).withdraw();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const balanceAfter = await ethers.provider.getBalance(owner.address);

    assert.strictEqual(balanceAfter.add(gasUsed).sub(balanceBefore).toString(), newMintPrice.toString());
    assert.strictEqual((await ethers.provider.getBalance(nft.address)).toString(), "0");
  });

  it("lets owner update palette before lock and rejects changes after lock", async function () {
    const [owner] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const nft = await NFT.connect(owner).deploy(
      "OnChainPixels",
      "OCPX",
      4,
      1,
      1,
      1000,
      ethers.utils.parseEther("0.01"),
      palette16()
    );
    await nft.deployed();

    await (await nft.connect(owner).setPalette(alternatePalette16())).wait();
    assert.strictEqual(await nft.palette(), alternatePalette16());

    await (await nft.connect(owner).lockPalette()).wait();
    assert.strictEqual(await nft.paletteLocked(), true);

    await expectCustomError(
      nft.connect(owner).setPalette(palette16()),
      "PaletteAlreadyLocked"
    );
  });

  it("supports palette lock before ownership handoff to a multisig owner", async function () {
    const [owner, multisig] = await ethers.getSigners();
    const mintPrice = ethers.utils.parseEther("0.01");

    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const Pool = await ethers.getContractFactory("PixelPool");
    const Router = await ethers.getContractFactory("PixelRouter");

    const nft = await NFT.connect(owner).deploy(
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

    const pool = await Pool.connect(owner).deploy(nft.address, mintPrice);
    await pool.deployed();

    const router = await Router.connect(owner).deploy(
      nft.address,
      pool.address,
      owner.address,
      mintPrice,
      6000,
      1000
    );
    await router.deployed();

    await (await nft.connect(owner).setMinter(router.address, true)).wait();
    await (await nft.connect(owner).setBurner(pool.address, true)).wait();
    await (await pool.connect(owner).setRouter(router.address)).wait();

    await (await nft.connect(owner).lockPalette()).wait();
    assert.strictEqual(await nft.paletteLocked(), true);

    await (await nft.connect(owner).transferOwnership(multisig.address)).wait();
    await (await pool.connect(owner).transferOwnership(multisig.address)).wait();
    await (await router.connect(owner).transferOwnership(multisig.address)).wait();

    assert.strictEqual(await nft.owner(), multisig.address);
    assert.strictEqual(await pool.owner(), multisig.address);
    assert.strictEqual(await router.owner(), multisig.address);

    await assert.rejects(
      nft.connect(owner).setMintPrice(ethers.utils.parseEther("0.02")),
      /Ownable: caller is not the owner/
    );

    await (await router.connect(multisig).setCreator(multisig.address)).wait();
    assert.strictEqual(await router.creator(), multisig.address);

    await expectCustomError(
      nft.connect(multisig).setPalette(alternatePalette16()),
      "PaletteAlreadyLocked"
    );
  });
});
