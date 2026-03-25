/**
 * OnChainPixel — Local Hardhat Deploy
 *
 * Deploys NFT + Pool + Router directly (no Factory) for local dev and frontend testing.
 * Outputs addresses ready to paste into frontend/src/appConfig.js.
 *
 * Usage:
 *   1. npm run node          (in another terminal)
 *   2. npx hardhat run scripts/deploy-local.js --network localhost
 */

const { ethers } = require("hardhat");

const PALETTE_16 = Buffer.from([
  0x00,0x00,0x00, 0xFF,0x00,0x00, 0x00,0xFF,0x00, 0x00,0x00,0xFF,
  0xFF,0xFF,0x00, 0xFF,0x00,0xFF, 0x00,0xFF,0xFF, 0xFF,0xFF,0xFF,
  0x80,0x00,0x00, 0x00,0x80,0x00, 0x00,0x00,0x80, 0x80,0x80,0x00,
  0x80,0x00,0x80, 0x00,0x80,0x80, 0x80,0x80,0x80, 0xC0,0xC0,0xC0,
]);

async function main() {
  const [deployer, creator] = await ethers.getSigners();
  const mintPrice = ethers.utils.parseEther("0.001");

  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Creator:  ${creator.address}\n`);

  // 1. Deploy NFT
  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy(
    "OnChainPixels", "OCPX",
    4,    // bitDepth
    32,   // width
    32,   // height
    10000, // maxSupply
    mintPrice,
    PALETTE_16
  );
  await nft.deployed();
  console.log(`NFT:    ${nft.address}`);

  // 2. Deploy Pool
  const Pool = await ethers.getContractFactory("PixelPool");
  const pool = await Pool.deploy(nft.address, mintPrice);
  await pool.deployed();
  console.log(`Pool:   ${pool.address}`);

  // 3. Deploy Router
  const Router = await ethers.getContractFactory("PixelRouter");
  const router = await Router.deploy(
    nft.address,
    pool.address,
    creator.address,
    mintPrice,
    6000,  // poolSeedBps (60%)
    1000   // treasuryBps (10%)
  );
  await router.deployed();
  console.log(`Router: ${router.address}`);

  // 4. Wire permissions
  await (await nft.setMinter(router.address, true)).wait();
  await (await nft.setBurner(pool.address, true)).wait();
  await (await pool.setRouter(router.address)).wait();
  console.log("\nPermissions wired: router=minter, pool=burner, pool.router=router");

  // 5. Seed initial liquidity so the pool is functional
  await (await pool.setRouter(deployer.address)).wait();
  await (await pool.seedLiquidity({ value: ethers.utils.parseEther("1") })).wait();
  await (await pool.setRouter(router.address)).wait();
  console.log("Seeded 1 ETH into pool reserve");

  // 6. Output appConfig
  console.log(`
--- Paste into frontend/src/appConfig.js ---

export const APP_CONFIG = Object.freeze({
  poolAddress: "${pool.address}",
  routerAddress: "${router.address}",
  nftAddress: "${nft.address}",
  rpcUrl: "http://127.0.0.1:8545",
  ethUsd: "2000",
});
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
