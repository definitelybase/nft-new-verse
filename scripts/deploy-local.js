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
  const mintPrice = ethers.utils.parseEther("0.001");
  const network = await ethers.provider.getNetwork();
  const networkLabel = network.name === "unknown" && network.chainId === 31337 ? "hardhat" : network.name;
  const isLocal = network.chainId === 31337;
  const creatorAddress = process.env.CREATOR_ADDRESS || fallbackCreator.address;
  const ownerAddress = process.env.OWNER_ADDRESS || process.env.SAFE_ADDRESS || deployer.address;
  const listingVaultAddress = process.env.LISTING_VAULT_ADDRESS || ownerAddress;
  const localSeedEth = process.env.LOCAL_POOL_SEED_ETH || "1";
  const shouldLockPalette = process.env.SKIP_PALETTE_LOCK !== "YES";

  if (!ethers.utils.isAddress(creatorAddress) || creatorAddress === ethers.constants.AddressZero) {
    throw new Error("CREATOR_ADDRESS must be a non-zero address");
  }
  if (!ethers.utils.isAddress(ownerAddress) || ownerAddress === ethers.constants.AddressZero) {
    throw new Error("OWNER_ADDRESS/SAFE_ADDRESS must be a non-zero address");
  }
  if (!ethers.utils.isAddress(listingVaultAddress) || listingVaultAddress === ethers.constants.AddressZero) {
    throw new Error("LISTING_VAULT_ADDRESS must be a non-zero address");
  }

  console.log(`\nNetwork: ${networkLabel} (chainId ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Creator:  ${creatorAddress}`);
  console.log(`Owner:    ${ownerAddress}`);
  console.log(`Listing:  ${listingVaultAddress}`);
  console.log(`Balance:  ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

  let totalGas = ethers.BigNumber.from(0);

  // 1. Deploy NFT
  const NFT = await ethers.getContractFactory("OnChainPixelNFT");
  const nft = await NFT.deploy(
    "OnChainPixels", "OCPX",
    4, 32, 32, 10000,
    mintPrice, PALETTE_16
  );
  let r = await nft.deployTransaction.wait();
  totalGas = totalGas.add(r.gasUsed);
  console.log(`NFT:    ${nft.address} (${r.gasUsed.toLocaleString()} gas)`);

  // 2. Deploy Pool
  const Pool = await ethers.getContractFactory("PixelPool");
  const pool = await Pool.deploy(nft.address, mintPrice);
  r = await pool.deployTransaction.wait();
  totalGas = totalGas.add(r.gasUsed);
  console.log(`Pool:   ${pool.address} (${r.gasUsed.toLocaleString()} gas)`);

  // 3. Deploy Router
  const Router = await ethers.getContractFactory("PixelRouter");
  const router = await Router.deploy(
    nft.address, pool.address, creatorAddress,
    mintPrice, 6000, 1000
  );
  r = await router.deployTransaction.wait();
  totalGas = totalGas.add(r.gasUsed);
  console.log(`Router: ${router.address} (${r.gasUsed.toLocaleString()} gas)`);

  // 4. Wire permissions
  let tx;
  tx = await nft.setMinter(router.address, true); await tx.wait();
  tx = await nft.setBurner(pool.address, true); await tx.wait();
  tx = await pool.setRouter(router.address); await tx.wait();
  tx = await pool.setListingVault(listingVaultAddress); await tx.wait();
  console.log("\nPermissions wired: router=minter, pool=burner, pool.router=router, pool.listingVault=listing vault");

  const routerIsMinter = await nft.isMinter(router.address);
  const poolIsBurner = await nft.isBurner(pool.address);
  const poolRouter = await pool.router();
  const poolListingVault = await pool.listingVault();
  if (!routerIsMinter || !poolIsBurner || poolRouter !== router.address || poolListingVault !== listingVaultAddress) {
    throw new Error("Post-deploy wiring verification failed");
  }

  // 5. Lock palette before handing ownership off
  if (shouldLockPalette) {
    tx = await nft.lockPalette();
    await tx.wait();
    console.log("Palette locked");
  } else {
    console.log("Palette left unlocked (SKIP_PALETTE_LOCK=YES)");
  }

  // 6. Seed initial liquidity (local only — on testnet, seed manually)
  if (isLocal) {
    const localSeedAmount = ethers.utils.parseEther(localSeedEth);
    tx = await pool.setRouter(deployer.address); await tx.wait();
    tx = await pool.seedLiquidity({ value: localSeedAmount }); await tx.wait();
    tx = await pool.setRouter(router.address); await tx.wait();
    console.log(`Seeded ${localSeedEth} ETH into pool reserve (local only)`);
  }

  // 7. Transfer ownership to final owner / multisig
  if (ownerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    tx = await nft.transferOwnership(ownerAddress); await tx.wait();
    tx = await pool.transferOwnership(ownerAddress); await tx.wait();
    tx = await router.transferOwnership(ownerAddress); await tx.wait();
    console.log(`Ownership transferred to ${ownerAddress}`);
  } else {
    console.log("Ownership retained by deployer");
  }

  const nftOwner = await nft.owner();
  const poolOwner = await pool.owner();
  const routerOwner = await router.owner();
  if (
    nftOwner.toLowerCase() !== ownerAddress.toLowerCase() ||
    poolOwner.toLowerCase() !== ownerAddress.toLowerCase() ||
    routerOwner.toLowerCase() !== ownerAddress.toLowerCase()
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
    deployer: deployer.address,
    creator: creatorAddress,
    owner: ownerAddress,
    listingVault: listingVaultAddress,
    paletteLocked: shouldLockPalette,
    totalGas: totalGas.toString(),
    appConfig: {
      chainId: String(network.chainId),
      poolAddress: pool.address,
      routerAddress: router.address,
      nftAddress: nft.address,
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
  rpcUrl: "${rpcUrl}",
  ethUsd: "2000",
});
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
