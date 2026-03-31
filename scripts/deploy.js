/**
 * Dwellers — Full Deploy Script
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
const {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
} = require("ethers-v6");
const fs = require("fs");
const path = require("path");

const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    rpcEnv: ["SEPOLIA_RPC_URL", "RPC_URL"],
    explorer: "https://sepolia.etherscan.io",
  },
  mainnet: {
    chainId: 1,
    rpcEnv: ["MAINNET_RPC_URL", "RPC_URL"],
    explorer: "https://etherscan.io",
  },
};

function firstEnv(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return "";
}

// Load all artifacts
function loadArtifact(name) {
  const abiPath = path.join(__dirname, `../build/${name}.abi`);
  const binPath = path.join(__dirname, `../build/${name}.bin`);
  if (!fs.existsSync(abiPath) || !fs.existsSync(binPath)) {
    throw new Error(`Missing build artifacts for ${name}. Run "npm run build" first.`);
  }
  return {
    abi: JSON.parse(fs.readFileSync(abiPath, "utf8")),
    bin: "0x" + fs.readFileSync(binPath, "utf8").trim(),
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
  name: "Dwellers",
  symbol: "OCPX",
  bitDepth: 4,
  defaultWidth: Number(process.env.DEFAULT_CANVAS_WIDTH || "16"),
  defaultHeight: Number(process.env.DEFAULT_CANVAS_HEIGHT || "16"),
  maxSupply: Number(process.env.MAX_SUPPLY || "1000"),
  mintPrice: parseEther("0.001"),
  poolSeedBps: 6000,  // 60%
  treasuryBps: 1000,  // 10%
  palette: PALETTE_16,
};

// ============================================================
//                        MAIN
// ============================================================

async function main() {
  const network = process.argv[2] || "sepolia";
  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Unsupported network "${network}". Use one of: ${Object.keys(NETWORKS).join(", ")}`);
  }

  const pk = firstEnv(["DEPLOYER_KEY", "PRIVATE_KEY"]);
  const rpc = firstEnv(networkConfig.rpcEnv);

  if (!pk || !rpc) {
    throw new Error(
      `Missing deploy env. Set DEPLOYER_KEY (or PRIVATE_KEY) and one of: ${networkConfig.rpcEnv.join(", ")}`
    );
  }

  if (network === "mainnet" && process.env.CONFIRM_MAINNET !== "YES") {
    throw new Error('Mainnet deploy blocked. Re-run with CONFIRM_MAINNET=YES once you really want it.');
  }

  const provider = new JsonRpcProvider(rpc);
  const providerNetwork = await provider.getNetwork();
  if (Number(providerNetwork.chainId) !== networkConfig.chainId) {
    throw new Error(
      `RPC/network mismatch: requested ${network} but RPC returned chainId ${providerNetwork.chainId}`
    );
  }

  const wallet = new Wallet(pk, provider);
  const creatorAddress = process.env.CREATOR_ADDRESS || wallet.address;
  const ownerAddress = process.env.OWNER_ADDRESS || process.env.SAFE_ADDRESS || wallet.address;
  const shouldLockPalette = process.env.SKIP_PALETTE_LOCK !== "YES";
  const balance = await provider.getBalance(wallet.address);
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 0n;

  if (!isAddress(creatorAddress) || creatorAddress === ZeroAddress) {
    throw new Error("CREATOR_ADDRESS must be a non-zero address");
  }
  if (!isAddress(ownerAddress) || ownerAddress === ZeroAddress) {
    throw new Error("OWNER_ADDRESS/SAFE_ADDRESS must be a non-zero address");
  }
  console.log(`\nDwellers Full Deploy -> ${network}`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Creator:  ${creatorAddress}`);
  console.log(`Owner:    ${ownerAddress}`);
  console.log(`Balance: ${formatEther(balance)} ETH`);
  console.log(`Gas: ${formatUnits(gasPrice, "gwei")} gwei\n`);

  const artifacts = {
    factory: loadArtifact("PixelFactory"),
    nft: loadArtifact("OnChainPixelNFT"),
    pool: loadArtifact("PixelPool"),
    router: loadArtifact("PixelRouter"),
    market: loadArtifact("PixelMarketplace"),
  };

  // ---- Step 1: Deploy Factory ----
  console.log("Step 1/4: Deploying PixelFactory...");
  const factoryFactory = new ContractFactory(
    artifacts.factory.abi, artifacts.factory.bin, wallet
  );
  const factory = await factoryFactory.deploy({ gasLimit: 2_000_000 });
  const factoryAddress = await factory.getAddress();
  let receipt = await factory.deploymentTransaction().wait();
  console.log(`   OK Factory: ${factoryAddress} (${receipt.gasUsed.toLocaleString()} gas)\n`);

  // ---- Step 2: Upload bytecodes ----
  console.log("Step 2/4: Uploading contract bytecodes to Factory...");
  
  let tx;
  tx = await factory.setNFTCode(artifacts.nft.bin, { gasLimit: 5_000_000 });
  await tx.wait();
  console.log("   OK NFT bytecode uploaded");

  tx = await factory.setPoolCode(artifacts.pool.bin, { gasLimit: 3_000_000 });
  await tx.wait();
  console.log("   OK Pool bytecode uploaded");

  tx = await factory.setRouterCode(artifacts.router.bin, { gasLimit: 2_000_000 });
  await tx.wait();
  console.log("   OK Router bytecode uploaded");

  tx = await factory.setMarketplaceCode(artifacts.market.bin, { gasLimit: 3_000_000 });
  await tx.wait();
  console.log("   OK Marketplace bytecode uploaded");
  console.log("   OK Factory initialized\n");

  // ---- Step 3: Create collection ----
  console.log("Step 3/4: Creating collection...");
  const { name, symbol, bitDepth, defaultWidth, defaultHeight, maxSupply, mintPrice, poolSeedBps, treasuryBps, palette } = COLLECTION;

  tx = await factory.createCollectionSafe(
    name, symbol, bitDepth, defaultWidth, defaultHeight,
    maxSupply, mintPrice, poolSeedBps, treasuryBps, palette,
    ownerAddress, shouldLockPalette,
    { gasLimit: 8_000_000 }
  );
  receipt = await tx.wait();

  // Parse event to get addresses
  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "CollectionCreated");
  const nftAddr = event?.args?.nft;
  const poolAddr = event?.args?.pool;
  const routerAddr = event?.args?.router;
  const marketAddr = event?.args?.market;
  if (!nftAddr || !poolAddr || !routerAddr || !marketAddr) {
    throw new Error("CollectionCreated event missing expected addresses");
  }

  console.log(`   OK Collection created (${receipt.gasUsed.toLocaleString()} gas)`);
  console.log(`   NFT:    ${nftAddr}`);
  console.log(`   Pool:   ${poolAddr}`);
  console.log(`   Router: ${routerAddr}`);
  console.log(`   Market: ${marketAddr}\n`);

  // ---- Step 4: Verify ----
  console.log("Step 4/4: Verifying deployment...");
  const nftContract = new Contract(nftAddr, artifacts.nft.abi, wallet);
  const poolContract = new Contract(poolAddr, artifacts.pool.abi, wallet);
  const routerContract = new Contract(routerAddr, artifacts.router.abi, wallet);
  const marketContract = new Contract(marketAddr, artifacts.market.abi, wallet);

  if (creatorAddress.toLowerCase() !== wallet.address.toLowerCase()) {
    tx = await routerContract.setCreator(creatorAddress);
    await tx.wait();
    console.log(`   OK Router creator updated: ${creatorAddress}`);
  }

  if (shouldLockPalette) {
    console.log("   OK Palette locked in factory flow");
  } else {
    console.log("   WARN Palette left unlocked (SKIP_PALETTE_LOCK=YES)");
  }

  if (ownerAddress.toLowerCase() !== wallet.address.toLowerCase()) {
    tx = await factory.transferOwnership(ownerAddress);
    await tx.wait();
    console.log(`   OK Factory ownership transferred to ${ownerAddress}`);
  } else {
    console.log("   OK Ownership retained by deployer");
  }

  const bd = await nftContract.bitDepth();
  const [w, h] = await nftContract.defaultCanvasSize();
  const ps = await nftContract.paletteSize();
  const isMinter = await nftContract.isMinter(routerAddr);
  const isBurner = await nftContract.isBurner(poolAddr);
  const poolRouter = await poolContract.router();
  const poolListingVault = await poolContract.listingVault();
  const marketOwner = await marketContract.owner();
  const paletteLocked = await nftContract.paletteLocked();

  console.log(`   NFT: bitDepth=${bd}, canvas=${w}x${h}, palette=${ps} colors`);
  console.log(`   Router is minter: ${isMinter}`);
  console.log(`   Pool is burner: ${isBurner}`);
  console.log(`   Pool router set: ${poolRouter === routerAddr}`);
  console.log(`   Pool listing vault: ${poolListingVault}`);
  console.log(`   Owner of Market: ${marketOwner}`);
  console.log(`   Palette locked: ${paletteLocked}`);
  console.log(`   Creator of Router: ${await routerContract.creator()}`);
  console.log(`   Owner of Factory: ${await factory.owner()}`);
  console.log(`   Owner of NFT: ${await nftContract.owner()}`);
  console.log(`   Owner of Pool: ${await poolContract.owner()}`);
  console.log(`   Owner of Router: ${await routerContract.owner()}`);

  // ---- Save deployment info ----
  const deployInfo = {
    network,
    chainId: providerNetwork.chainId,
    factory: factoryAddress,
    collection: {
      nft: nftAddr,
      pool: poolAddr,
      router: routerAddr,
      market: marketAddr,
    },
    deployer: wallet.address,
    creator: creatorAddress,
    owner: ownerAddress,
    listingVault: marketAddr,
    paletteLocked,
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
    appConfig: {
      chainId: String(providerNetwork.chainId),
      poolAddress: poolAddr,
      routerAddress: routerAddr,
      nftAddress: nftAddr,
      marketplaceAddress: marketAddr,
      rpcUrl: rpc,
      ethUsd: "2000",
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(`deployment-${network}.json`, JSON.stringify(deployInfo, null, 2));

  console.log(`\nSaved to deployment-${network}.json`);
  console.log(`\n--- Paste into frontend/src/appConfig.js ---\n`);
  console.log(`export const APP_CONFIG = Object.freeze({
  chainId: "${providerNetwork.chainId}",
  poolAddress: "${poolAddr}",
  routerAddress: "${routerAddr}",
  nftAddress: "${nftAddr}",
  marketplaceAddress: "${marketAddr}",
  rpcUrl: "${rpc}",
  ethUsd: "2000",
});`);
  console.log(`\nLinks:`);
  console.log(`   Factory: ${networkConfig.explorer}/address/${factoryAddress}`);
  console.log(`   NFT:     ${networkConfig.explorer}/address/${nftAddr}`);
  console.log(`   Pool:    ${networkConfig.explorer}/address/${poolAddr}`);
  console.log(`   Router:  ${networkConfig.explorer}/address/${routerAddr}`);
  console.log(`   Market:  ${networkConfig.explorer}/address/${marketAddr}`);
  console.log(`\nDONE. Collection is live. Mint via Router at ${routerAddr}`);
}

main().catch(e => {
  console.error("\n❌ Error:", e.message || e);
  process.exit(1);
});
