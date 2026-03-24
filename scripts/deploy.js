/**
 * OnChainPixel — Full Deploy Script
 * 
 * Deploys everything in order:
 *   1. Deploy PixelFactory
 *   2. Upload NFT/Pool/Router bytecodes to Factory
 *   3. Create first collection via Factory
 * 
 * Usage:
 *   npm run build
 *   PRIVATE_KEY=0x... RPC_URL=https://... node scripts/deploy.js [sepolia|mainnet]
 * 
 * Result: Fully deployed collection with NFT + Pool + Router, all wired.
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load all artifacts
function loadArtifact(name) {
  return {
    abi: JSON.parse(fs.readFileSync(path.join(__dirname, `../build/${name}.abi`), "utf8")),
    bin: "0x" + fs.readFileSync(path.join(__dirname, `../build/${name}.bin`), "utf8").trim(),
  };
}

// 16-color classic pixel art palette
const PALETTE_16 = Buffer.from([
  0x00,0x00,0x00, 0xFF,0x00,0x00, 0x00,0xFF,0x00, 0x00,0x00,0xFF,
  0xFF,0xFF,0x00, 0xFF,0x00,0xFF, 0x00,0xFF,0xFF, 0xFF,0xFF,0xFF,
  0x80,0x00,0x00, 0x00,0x80,0x00, 0x00,0x00,0x80, 0x80,0x80,0x00,
  0x80,0x00,0x80, 0x00,0x80,0x80, 0x80,0x80,0x80, 0xC0,0xC0,0xC0,
]);

// ============================================================
//                     COLLECTION CONFIG
// ============================================================

const COLLECTION = {
  name: "OnChainPixels",
  symbol: "OCPX",
  bitDepth: 4,
  defaultWidth: 32,
  defaultHeight: 32,
  maxSupply: 10000,
  mintPrice: ethers.utils.parseEther("0.001"),
  poolSeedBps: 6000,  // 60%
  treasuryBps: 1000,  // 10%
  palette: PALETTE_16,
};

// ============================================================
//                        MAIN
// ============================================================

async function main() {
  const network = process.argv[2] || "sepolia";
  const pk = process.env.PRIVATE_KEY;
  const rpc = process.env.RPC_URL;

  if (!pk || !rpc) {
    console.error("Usage: PRIVATE_KEY=0x... RPC_URL=https://... node deploy.js [sepolia|mainnet]");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const balance = await wallet.getBalance();
  const gasPrice = await provider.getGasPrice();

  console.log(`\n🚀 OnChainPixel Full Deploy → ${network}`);
  console.log(`📍 Deployer: ${wallet.address}`);
  console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);
  console.log(`⛽ Gas: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei\n`);

  const artifacts = {
    factory: loadArtifact("PixelFactory"),
    nft: loadArtifact("OnChainPixelNFT"),
    pool: loadArtifact("PixelPool"),
    router: loadArtifact("PixelRouter"),
  };

  // ---- Step 1: Deploy Factory ----
  console.log("📦 Step 1/4: Deploying PixelFactory...");
  const factoryFactory = new ethers.ContractFactory(
    artifacts.factory.abi, artifacts.factory.bin, wallet
  );
  const factory = await factoryFactory.deploy({ gasLimit: 2_000_000 });
  let receipt = await factory.deployTransaction.wait();
  console.log(`   ✅ Factory: ${factory.address} (${receipt.gasUsed.toLocaleString()} gas)\n`);

  // ---- Step 2: Upload bytecodes ----
  console.log("📤 Step 2/4: Uploading contract bytecodes to Factory...");
  
  let tx;
  tx = await factory.setNFTCode(artifacts.nft.bin, { gasLimit: 5_000_000 });
  await tx.wait();
  console.log("   ✅ NFT bytecode uploaded");

  tx = await factory.setPoolCode(artifacts.pool.bin, { gasLimit: 3_000_000 });
  await tx.wait();
  console.log("   ✅ Pool bytecode uploaded");

  tx = await factory.setRouterCode(artifacts.router.bin, { gasLimit: 2_000_000 });
  await tx.wait();
  console.log("   ✅ Router bytecode uploaded");
  console.log("   ✅ Factory initialized\n");

  // ---- Step 3: Create collection ----
  console.log("🎨 Step 3/4: Creating collection...");
  const { name, symbol, bitDepth, defaultWidth, defaultHeight, maxSupply, mintPrice, poolSeedBps, treasuryBps, palette } = COLLECTION;

  tx = await factory.createCollection(
    name, symbol, bitDepth, defaultWidth, defaultHeight,
    maxSupply, mintPrice, poolSeedBps, treasuryBps, palette,
    { gasLimit: 8_000_000 }
  );
  receipt = await tx.wait();

  // Parse event to get addresses
  const event = receipt.events?.find(e => e.event === "CollectionCreated");
  const nftAddr = event?.args?.nft;
  const poolAddr = event?.args?.pool;
  const routerAddr = event?.args?.router;

  console.log(`   ✅ Collection created! (${receipt.gasUsed.toLocaleString()} gas)`);
  console.log(`   📍 NFT:    ${nftAddr}`);
  console.log(`   📍 Pool:   ${poolAddr}`);
  console.log(`   📍 Router: ${routerAddr}\n`);

  // ---- Step 4: Verify ----
  console.log("🔍 Step 4/4: Verifying deployment...");
  const nftContract = new ethers.Contract(nftAddr, artifacts.nft.abi, wallet);
  const poolContract = new ethers.Contract(poolAddr, artifacts.pool.abi, wallet);
  const routerContract = new ethers.Contract(routerAddr, artifacts.router.abi, wallet);

  const bd = await nftContract.bitDepth();
  const [w, h] = await nftContract.defaultCanvasSize();
  const ps = await nftContract.paletteSize();
  const isMinter = await nftContract.isMinter(routerAddr);
  const poolRouter = await poolContract.router();

  console.log(`   NFT: bitDepth=${bd}, canvas=${w}x${h}, palette=${ps} colors`);
  console.log(`   Router is minter: ${isMinter}`);
  console.log(`   Pool router set: ${poolRouter === routerAddr}`);
  console.log(`   Owner of NFT: ${await nftContract.owner()}`);
  console.log(`   Owner of Pool: ${await poolContract.owner()}`);
  console.log(`   Owner of Router: ${await routerContract.owner()}`);

  // ---- Save deployment info ----
  const deployInfo = {
    network,
    factory: factory.address,
    collection: {
      nft: nftAddr,
      pool: poolAddr,
      router: routerAddr,
    },
    deployer: wallet.address,
    config: {
      name,
      symbol,
      bitDepth,
      defaultWidth,
      defaultHeight,
      maxSupply: maxSupply.toString(),
      mintPrice: mintPrice.toString(),
      poolSeedBps,
      treasuryBps,
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(`deployment-${network}.json`, JSON.stringify(deployInfo, null, 2));
  
  const explorer = network === "mainnet" ? "https://etherscan.io" : "https://sepolia.etherscan.io";

  console.log(`\n💾 Saved to deployment-${network}.json`);
  console.log(`\n🔗 Links:`);
  console.log(`   Factory: ${explorer}/address/${factory.address}`);
  console.log(`   NFT:     ${explorer}/address/${nftAddr}`);
  console.log(`   Pool:    ${explorer}/address/${poolAddr}`);
  console.log(`   Router:  ${explorer}/address/${routerAddr}`);
  console.log(`\n✅ DONE! Collection is live. Mint via Router at ${routerAddr}`);
}

main().catch(e => {
  console.error("\n❌ Error:", e.message || e);
  process.exit(1);
});
