/**
 * OnChainPixel — Direct Deploy (no Factory)
 *
 * Deploys NFT + Pool + Router directly. 5x cheaper than Factory pattern.
 * Works on localhost, Sepolia, or any network configured in hardhat.config.js.
 *
 * Usage:
 *   Local:   npm run node && npm run deploy:local
 *   Sepolia: npx hardhat run scripts/deploy-local.js --network sepolia
 *
 * Gas cost comparison:
 *   Factory flow:  ~37M gas (5 txs: deploy + 3 uploads + createCollection)
 *   Direct deploy: ~7.8M gas (3 txs: NFT + Pool + Router + wiring)
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ZeroAddress, formatEther, isAddress, parseEther } = require("ethers-v6");

const PALETTE_16 = Buffer.from([
  0x00,0x00,0x00, 0xFF,0x00,0x00, 0x00,0xFF,0x00, 0x00,0x00,0xFF,
  0xFF,0xFF,0x00, 0xFF,0x00,0xFF, 0x00,0xFF,0xFF, 0xFF,0xFF,0xFF,
  0x80,0x00,0x00, 0x00,0x80,0x00, 0x00,0x00,0x80, 0x80,0x80,0x00,
  0x80,0x00,0x80, 0x00,0x80,0x80, 0x80,0x80,0x80, 0xC0,0xC0,0xC0,
]);

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const fallbackCreator = signers[1] || deployer;
  if (!deployer) {
    throw new Error("No deployer signer available for the selected network");
  }
  const mintPrice = parseEther("0.001");
  const network = await ethers.provider.getNetwork();
  const networkLabel = network.name === "unknown" && network.chainId === 31337 ? "hardhat" : network.name;
  const isLocal = network.chainId === 31337;
  const creatorAddress = process.env.CREATOR_ADDRESS || fallbackCreator.address;
  const ownerAddress = process.env.OWNER_ADDRESS || process.env.SAFE_ADDRESS || deployer.address;
  const localSeedEth = process.env.LOCAL_POOL_SEED_ETH || "1";
  const shouldLockPalette = process.env.SKIP_PALETTE_LOCK !== "YES";
  const marketFeeBps = Number(process.env.MARKETPLACE_FEE_BPS || "250");
  const defaultWidth = Number(process.env.DEFAULT_CANVAS_WIDTH || "16");
  const defaultHeight = Number(process.env.DEFAULT_CANVAS_HEIGHT || "16");
  const maxSupply = Number(process.env.MAX_SUPPLY || "1000");

  if (!isAddress(creatorAddress) || creatorAddress === ZeroAddress) {
    throw new Error("CREATOR_ADDRESS must be a non-zero address");
  }
  if (!isAddress(ownerAddress) || ownerAddress === ZeroAddress) {
    throw new Error("OWNER_ADDRESS/SAFE_ADDRESS must be a non-zero address");
  }
  if (!Number.isFinite(marketFeeBps) || marketFeeBps < 0 || marketFeeBps > 10000) {
    throw new Error("MARKETPLACE_FEE_BPS must be between 0 and 10000");
  }
  if (!Number.isFinite(maxSupply) || maxSupply <= 0) {
    throw new Error("MAX_SUPPLY must be a positive integer");
  }

  console.log(`\nNetwork: ${networkLabel} (chainId ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Creator:  ${creatorAddress}`);
  console.log(`Owner:    ${ownerAddress}`);
  console.log(`Balance:  ${formatEther(BigInt((await deployer.getBalance()).toString()))} ETH\n`);

  let totalGas = 0n;

  // 1. Deploy NFT
  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy(
    "OnChainPixels", "OCPX",
    4, defaultWidth, defaultHeight, maxSupply,
    mintPrice, PALETTE_16
  );
  let r = await nft.deployTransaction.wait();
  totalGas += BigInt(r.gasUsed.toString());
  console.log(`NFT:    ${nft.address} (${r.gasUsed.toLocaleString()} gas)`);

  // 2. Deploy Pool
  const Pool = await ethers.getContractFactory("PixelPool");
  const pool = await Pool.deploy(nft.address, mintPrice);
  r = await pool.deployTransaction.wait();
  totalGas += BigInt(r.gasUsed.toString());
  console.log(`Pool:   ${pool.address} (${r.gasUsed.toLocaleString()} gas)`);

  // 3. Deploy Router
  const Router = await ethers.getContractFactory("PixelRouter");
  const router = await Router.deploy(
    nft.address, pool.address, creatorAddress,
    mintPrice, 6000, 1000
  );
  r = await router.deployTransaction.wait();
  totalGas += BigInt(r.gasUsed.toString());
  console.log(`Router: ${router.address} (${r.gasUsed.toLocaleString()} gas)`);

  // 4. Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("PixelMarketplace");
  const market = await Marketplace.deploy(nft.address, pool.address, marketFeeBps);
  r = await market.deployTransaction.wait();
  totalGas += BigInt(r.gasUsed.toString());
  console.log(`Market: ${market.address} (${r.gasUsed.toLocaleString()} gas)`);

  // 5. Wire permissions
  let tx;
  tx = await nft.setMinter(router.address, true); await tx.wait();
  tx = await nft.setBurner(pool.address, true); await tx.wait();
  tx = await pool.setRouter(router.address); await tx.wait();
  tx = await pool.setListingVault(market.address); await tx.wait();
  console.log("\nPermissions wired: router=minter, pool=burner, pool.router=router, pool.listingVault=market");

  const routerIsMinter = await nft.isMinter(router.address);
  const poolIsBurner = await nft.isBurner(pool.address);
  const poolRouter = await pool.router();
  const poolListingVault = await pool.listingVault();
  if (!routerIsMinter || !poolIsBurner || poolRouter !== router.address || poolListingVault !== market.address) {
    throw new Error("Post-deploy wiring verification failed");
  }

  // 6. Lock palette before handing ownership off
  if (shouldLockPalette) {
    tx = await nft.lockPalette();
    await tx.wait();
    console.log("Palette locked");
  } else {
    console.log("Palette left unlocked (SKIP_PALETTE_LOCK=YES)");
  }

  // 7. Seed initial liquidity (local only — on testnet, seed manually)
  if (isLocal) {
    const localSeedAmount = parseEther(localSeedEth);
    tx = await pool.setRouter(deployer.address); await tx.wait();
    tx = await pool.seedLiquidity({ value: localSeedAmount }); await tx.wait();
    tx = await pool.setRouter(router.address); await tx.wait();
    console.log(`Seeded ${localSeedEth} ETH into pool reserve (local only)`);
  }

  // 8. Transfer ownership to final owner / multisig
  if (ownerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    tx = await nft.transferOwnership(ownerAddress); await tx.wait();
    tx = await pool.transferOwnership(ownerAddress); await tx.wait();
    tx = await router.transferOwnership(ownerAddress); await tx.wait();
    tx = await market.transferOwnership(ownerAddress); await tx.wait();
    console.log(`Ownership transferred to ${ownerAddress}`);
  } else {
    console.log("Ownership retained by deployer");
  }

  const nftOwner = await nft.owner();
  const poolOwner = await pool.owner();
  const routerOwner = await router.owner();
  const marketOwner = await market.owner();
  if (
    nftOwner.toLowerCase() !== ownerAddress.toLowerCase() ||
    poolOwner.toLowerCase() !== ownerAddress.toLowerCase() ||
    routerOwner.toLowerCase() !== ownerAddress.toLowerCase() ||
    marketOwner.toLowerCase() !== ownerAddress.toLowerCase()
  ) {
    throw new Error("Ownership handoff verification failed");
  }

  // 8. Save deployment info
  const rpcUrl = isLocal ? "http://127.0.0.1:8545" : "";
  const deployInfo = {
    network: networkLabel,
    chainId: network.chainId,
    nft: nft.address,
    pool: pool.address,
    router: router.address,
    market: market.address,
    deployer: deployer.address,
    creator: creatorAddress,
    owner: ownerAddress,
    listingVault: market.address,
    paletteLocked: shouldLockPalette,
    totalGas: String(totalGas),
    appConfig: {
      chainId: String(network.chainId),
      poolAddress: pool.address,
      routerAddress: router.address,
      nftAddress: nft.address,
      marketplaceAddress: market.address,
      rpcUrl: isLocal ? "http://127.0.0.1:8545" : "",
      ethUsd: "2000",
    },
    timestamp: new Date().toISOString(),
  };

  const filename = `deployment-${network.chainId}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployInfo, null, 2));

  console.log(`\nTotal deploy gas: ${totalGas.toLocaleString()}`);
  console.log(`Saved to ${path.resolve(filename)}`);

  // 7. Output appConfig
  console.log(`
--- Paste into frontend/src/appConfig.js ---

export const APP_CONFIG = Object.freeze({
  chainId: "${network.chainId}",
  poolAddress: "${pool.address}",
  routerAddress: "${router.address}",
  nftAddress: "${nft.address}",
  marketplaceAddress: "${market.address}",
  rpcUrl: "${rpcUrl}",
  ethUsd: "2000",
});
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
