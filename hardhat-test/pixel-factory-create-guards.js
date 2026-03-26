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

describe("PixelFactory creation guards", function () {
  it("rejects empty bytecode uploads for all stack components", async function () {
    const [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PixelFactory");
    const factory = await Factory.connect(owner).deploy();
    await factory.deployed();

    await expectCustomError(factory.connect(owner).setNFTCode("0x"), "MissingBytecode");
    await expectCustomError(factory.connect(owner).setPoolCode("0x"), "MissingBytecode");
    await expectCustomError(factory.connect(owner).setRouterCode("0x"), "MissingBytecode");
    await expectCustomError(factory.connect(owner).setMarketplaceCode("0x"), "MissingBytecode");
  });

  it("reverts createCollection when any required bytecode is missing", async function () {
    const [owner, creator] = await ethers.getSigners();
    const mintPrice = ethers.utils.parseEther("0.01");
    const Factory = await ethers.getContractFactory("PixelFactory");
    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const Pool = await ethers.getContractFactory("PixelPool");
    const Router = await ethers.getContractFactory("PixelRouter");
    const Market = await ethers.getContractFactory("PixelMarketplace");
    async function expectMissingAfterSetup({ setNFT, setPool, setRouter, setMarket }) {
      const factory = await Factory.connect(owner).deploy();
      await factory.deployed();

      if (setNFT) await (await factory.connect(owner).setNFTCode(NFT.bytecode)).wait();
      if (setPool) await (await factory.connect(owner).setPoolCode(Pool.bytecode)).wait();
      if (setRouter) await (await factory.connect(owner).setRouterCode(Router.bytecode)).wait();
      if (setMarket) await (await factory.connect(owner).setMarketplaceCode(Market.bytecode)).wait();

      await expectCustomError(
        factory.connect(creator).createCollection(
          "FactoryPixels",
          "FPXL",
          4,
          1,
          1,
          1000,
          mintPrice,
          6000,
          1000,
          palette16()
        ),
        "MissingBytecode"
      );
    }

    await expectMissingAfterSetup({ setNFT: true, setPool: true, setRouter: false, setMarket: true });
    await expectMissingAfterSetup({ setNFT: true, setPool: false, setRouter: true, setMarket: true });
    await expectMissingAfterSetup({ setNFT: false, setPool: true, setRouter: true, setMarket: true });
    await expectMissingAfterSetup({ setNFT: true, setPool: true, setRouter: true, setMarket: false });
  });

  it("reverts createCollection when pool and treasury bps exceed 100%", async function () {
    const [owner, creator] = await ethers.getSigners();
    const mintPrice = ethers.utils.parseEther("0.01");
    const Factory = await ethers.getContractFactory("PixelFactory");
    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const Pool = await ethers.getContractFactory("PixelPool");
    const Router = await ethers.getContractFactory("PixelRouter");
    const Market = await ethers.getContractFactory("PixelMarketplace");

    const factory = await Factory.connect(owner).deploy();
    await factory.deployed();

    await (await factory.connect(owner).setNFTCode(NFT.bytecode)).wait();
    await (await factory.connect(owner).setPoolCode(Pool.bytecode)).wait();
    await (await factory.connect(owner).setRouterCode(Router.bytecode)).wait();
    await (await factory.connect(owner).setMarketplaceCode(Market.bytecode)).wait();

    await expectCustomError(
      factory.connect(creator).createCollection(
        "FactoryPixels",
        "FPXL",
        4,
        1,
        1,
        1000,
        mintPrice,
        9000,
        1001,
        palette16()
      ),
      "InvalidBps"
    );
  });

  it("reverts with DeployFailed when uploaded bytecode does not match the expected constructor", async function () {
    const [owner, creator] = await ethers.getSigners();
    const mintPrice = ethers.utils.parseEther("0.01");
    const Factory = await ethers.getContractFactory("PixelFactory");
    const NFT = await ethers.getContractFactory("OnChainPixelNFT");
    const Pool = await ethers.getContractFactory("PixelPool");
    const Market = await ethers.getContractFactory("PixelMarketplace");

    const factory = await Factory.connect(owner).deploy();
    await factory.deployed();

    await (await factory.connect(owner).setNFTCode(NFT.bytecode)).wait();
    await (await factory.connect(owner).setPoolCode(Pool.bytecode)).wait();
    await (await factory.connect(owner).setRouterCode(NFT.bytecode)).wait();
    await (await factory.connect(owner).setMarketplaceCode(Market.bytecode)).wait();

    await expectCustomError(
      factory.connect(creator).createCollection(
        "FactoryPixels",
        "FPXL",
        4,
        1,
        1,
        1000,
        mintPrice,
        6000,
        1000,
        palette16()
      ),
      "DeployFailed"
    );
  });
});
