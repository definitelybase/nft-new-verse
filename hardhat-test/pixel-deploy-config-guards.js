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

async function expectCustomError(promise, errorName) {
  await assert.rejects(promise, new RegExp(errorName));
}

describe("Deploy and config guards", function () {
  it("rejects zero mint price in NFT constructor and setter", async function () {
    const [owner] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const mintPrice = ethers.utils.parseEther("0.01");

    await expectCustomError(
      NFT.connect(owner).deploy("OnChainPixels", "OCPX", 4, 1, 1, 1000, 0, palette16()),
      "InvalidAmount"
    );

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

    await expectCustomError(
      nft.connect(owner).setMintPrice(0),
      "InvalidAmount"
    );
  });

  it("rejects invalid pool constructor dependencies", async function () {
    const [owner] = await ethers.getSigners();
    const Pool = await ethers.getContractFactory("PixelPool");
    const mintPrice = ethers.utils.parseEther("0.01");

    await expectCustomError(
      Pool.connect(owner).deploy(owner.address, mintPrice),
      "InvalidDependency"
    );
  });

  it("rejects invalid router constructor dependencies and zero mint price", async function () {
    const [owner, creator] = await ethers.getSigners();
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

    await expectCustomError(
      Router.connect(owner).deploy(owner.address, pool.address, creator.address, mintPrice, 6000, 1000),
      "InvalidDependency"
    );

    await expectCustomError(
      Router.connect(owner).deploy(nft.address, owner.address, creator.address, mintPrice, 6000, 1000),
      "InvalidDependency"
    );

    const router = await Router.connect(owner).deploy(
      nft.address,
      pool.address,
      creator.address,
      mintPrice,
      6000,
      1000
    );
    await router.deployed();

    await expectCustomError(
      Router.connect(owner).deploy(nft.address, pool.address, creator.address, 0, 6000, 1000),
      "InvalidAmount"
    );

    await expectCustomError(
      router.connect(owner).setMintPrice(0),
      "InvalidAmount"
    );
  });

  it("rejects zero mint price in factory createCollection", async function () {
    const [owner, creator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PixelFactory");
    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const Pool = await ethers.getContractFactory("PixelPool");
    const Router = await ethers.getContractFactory("PixelRouter");

    const factory = await Factory.connect(owner).deploy();
    await factory.deployed();

    await (await factory.connect(owner).setNFTCode(NFT.bytecode)).wait();
    await (await factory.connect(owner).setPoolCode(Pool.bytecode)).wait();
    await (await factory.connect(owner).setRouterCode(Router.bytecode)).wait();

    await expectCustomError(
      factory.connect(creator).createCollection(
        "FactoryPixels",
        "FPXL",
        4,
        1,
        1,
        1000,
        0,
        6000,
        1000,
        palette16()
      ),
      "InvalidAmount"
    );
  });
});
