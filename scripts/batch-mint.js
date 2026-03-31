/**
 * Mint the full collection using PixelRouter.mint() — one tx per NFT.
 *
 * Reads payloads from frontend/public/collection/payloads.json.
 *
 * Usage:
 *   npx hardhat run scripts/batch-mint.js --network localhost
 *   npx hardhat run scripts/batch-mint.js --network sepolia
 *
 * Environment variables:
 *   ROUTER_ADDRESS  — deployed PixelRouter address (or reads from deployment-<chainId>.json)
 *   START_ID        — skip already-minted tokens (default: 0)
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const [signer] = await ethers.getSigners();

  // Resolve router address
  let routerAddress = process.env.ROUTER_ADDRESS;
  if (!routerAddress) {
    const deployFile = path.join(__dirname, "..", `deployment-${chainId}.json`);
    if (fs.existsSync(deployFile)) {
      const deploy = JSON.parse(fs.readFileSync(deployFile, "utf8"));
      routerAddress = deploy.router;
    }
  }
  if (!routerAddress) {
    throw new Error("Set ROUTER_ADDRESS or ensure deployment-<chainId>.json exists");
  }

  // Load payloads
  const payloadsPath = path.join(__dirname, "..", "frontend", "public", "collection", "payloads.json");
  if (!fs.existsSync(payloadsPath)) {
    throw new Error("Run `node scripts/generate-collection.cjs` first to generate payloads");
  }
  const allPayloads = JSON.parse(fs.readFileSync(payloadsPath, "utf8"));
  const totalIds = Object.keys(allPayloads).map(Number).sort((a, b) => a - b);

  const startId = Number(process.env.START_ID || "0");
  const ids = totalIds.filter(id => id >= startId);
  if (ids.length === 0) {
    console.log("Nothing to mint — all tokens already covered.");
    return;
  }

  const routerAbi = [
    "function mint(bytes calldata pixelData) external payable",
    "function mintPrice() external view returns (uint256)",
  ];
  const router = new ethers.Contract(routerAddress, routerAbi, signer);
  const mintPrice = await router.mintPrice();

  console.log(`Network:    ${network.name} (chainId ${chainId})`);
  console.log(`Router:     ${routerAddress}`);
  console.log(`Minter:     ${signer.address}`);
  console.log(`Mint price: ${ethers.utils.formatEther(mintPrice)} ETH`);
  console.log(`To mint:    ${ids.length} NFTs (IDs ${ids[0]}..${ids[ids.length - 1]})`);
  console.log("");

  let minted = 0;
  for (const id of ids) {
    const payload = allPayloads[String(id)];
    console.log(`Minting #${id}...`);

    const tx = await router.mint(payload, { value: mintPrice });
    const receipt = await tx.wait();
    minted++;

    console.log(`  tx: ${tx.hash} (${receipt.gasUsed.toLocaleString()} gas) — ${minted}/${ids.length}`);
  }

  console.log(`\nDone! Minted ${minted} NFTs.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
