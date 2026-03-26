const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { getAddress } = require("ethers-v6");

function normalizeAddress(value) {
  return getAddress(value);
}

function resolveDeploymentFile(explicitFile, chainId) {
  if (explicitFile) {
    return path.resolve(process.cwd(), explicitFile);
  }
  return path.resolve(process.cwd(), `deployment-${chainId}.json`);
}

function loadDeployment(filename) {
  if (!fs.existsSync(filename)) {
    throw new Error(`Deployment file not found: ${filename}`);
  }
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

async function transferOne(contract, label, from, to) {
  const currentOwner = normalizeAddress(await contract.owner());
  if (currentOwner === to) {
    console.log(`${label}: already owned by ${to}`);
    return false;
  }
  if (currentOwner !== from) {
    throw new Error(`${label} owner is ${currentOwner}, expected signer ${from}`);
  }
  const tx = await contract.transferOwnership(to);
  await tx.wait();
  const newOwner = normalizeAddress(await contract.owner());
  if (newOwner !== to) {
    throw new Error(`${label} ownership transfer failed`);
  }
  console.log(`${label}: ownership transferred to ${to}`);
  return true;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const explicitFile = process.argv[2] && process.argv[2].endsWith(".json") ? process.argv[2] : "";
  const filename = resolveDeploymentFile(explicitFile, network.chainId);
  const deployment = loadDeployment(filename);

  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No signer available for ownership transfer");
  }

  const signerAddress = normalizeAddress(signer.address);
  const newOwnerAddress = process.env.NEW_OWNER_ADDRESS || process.env.SAFE_ADDRESS;
  if (!newOwnerAddress) {
    throw new Error("Set NEW_OWNER_ADDRESS or SAFE_ADDRESS before running the script");
  }
  const targetOwner = normalizeAddress(newOwnerAddress);

  const nftAddress = normalizeAddress(deployment.collection ? deployment.collection.nft : deployment.nft);
  const poolAddress = normalizeAddress(deployment.collection ? deployment.collection.pool : deployment.pool);
  const routerAddress = normalizeAddress(deployment.collection ? deployment.collection.router : deployment.router);
  const marketAddress = deployment.collection?.market || deployment.market
    ? normalizeAddress(deployment.collection ? deployment.collection.market : deployment.market)
    : "";
  const factoryAddress = deployment.factory ? normalizeAddress(deployment.factory) : "";

  console.log(`Network: ${network.name} (chainId ${network.chainId})`);
  console.log(`Signer:  ${signerAddress}`);
  console.log(`Target:  ${targetOwner}`);
  console.log(`File:    ${filename}\n`);

  const nft = await ethers.getContractAt("OnChainPixelNFT", nftAddress, signer);
  const pool = await ethers.getContractAt("PixelPool", poolAddress, signer);
  const router = await ethers.getContractAt("PixelRouter", routerAddress, signer);
  const market = marketAddress
    ? await ethers.getContractAt("PixelMarketplace", marketAddress, signer)
    : null;

  let changed = false;
  changed = (await transferOne(nft, "NFT", signerAddress, targetOwner)) || changed;
  changed = (await transferOne(pool, "Pool", signerAddress, targetOwner)) || changed;
  changed = (await transferOne(router, "Router", signerAddress, targetOwner)) || changed;
  if (market) {
    changed = (await transferOne(market, "Market", signerAddress, targetOwner)) || changed;
  }

  if (factoryAddress) {
    const factory = await ethers.getContractAt("PixelFactory", factoryAddress, signer);
    changed = (await transferOne(factory, "Factory", signerAddress, targetOwner)) || changed;
  }

  if (!changed) {
    console.log("\nNothing changed.");
    return;
  }

  deployment.owner = targetOwner;
  deployment.ownershipTransferredAt = new Date().toISOString();
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));

  console.log(`\nDeployment file updated: ${filename}`);
  console.log("Run verify:deploy next to confirm final ownership.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
