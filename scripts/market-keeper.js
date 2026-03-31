const fs = require("fs");
const path = require("path");
const { Contract, JsonRpcProvider, Wallet, ZeroAddress, formatEther, getAddress, parseEther } = require("ethers-v6");

const MARKET_STATES = ["Expansion", "Stabilization", "WeakDemand"];

function loadArtifact(name) {
  const hardhatArtifactPath = path.join(
    __dirname,
    `../artifacts/contracts/${name}.sol/${name}.json`
  );
  if (fs.existsSync(hardhatArtifactPath)) {
    return JSON.parse(fs.readFileSync(hardhatArtifactPath, "utf8")).abi;
  }

  const abiPath = path.join(__dirname, `../build/${name}.abi`);
  if (fs.existsSync(abiPath)) {
    return JSON.parse(fs.readFileSync(abiPath, "utf8"));
  }

  throw new Error(`Missing ABI for ${name}. Run "npm test" or "npm run build" first.`);
}

function normalizeAddress(value) {
  return getAddress(value);
}

function readDeployment(fileArg, networkArg) {
  if (fileArg) {
    const filename = path.resolve(process.cwd(), fileArg);
    return {
      filename,
      json: JSON.parse(fs.readFileSync(filename, "utf8")),
    };
  }

  const network = networkArg || "sepolia";
  const filename = path.resolve(process.cwd(), `deployment-${network}.json`);
  if (!fs.existsSync(filename)) {
    throw new Error(`Deployment file not found: ${filename}`);
  }
  return {
    filename,
    json: JSON.parse(fs.readFileSync(filename, "utf8")),
  };
}

function parsePriceInput(value) {
  if (!value) {
    throw new Error("Missing price value");
  }
  if (value.startsWith("0x")) {
    return BigInt(value);
  }
  if (value.includes(".")) {
    return parseEther(value);
  }
  return BigInt(value);
}

function fmtEth(value) {
  return `${formatEther(value)} ETH`;
}

function toSafeTx(target, data, note) {
  return {
    to: target,
    value: "0",
    data,
    operation: 0,
    note,
  };
}

function predictState({ now, launchTimestamp, launchProtection, purchaseRateBps, listingPressureBps, floorRatioBps, expansionPurchaseRateBps, expansionListingPressureBps, expansionFloorRatioBps, weakDemandPurchaseRateBps, weakDemandListingPressureBps, weakDemandFloorRatioBps }) {
  if (now < launchTimestamp + launchProtection) {
    return "Expansion";
  }

  if (
    purchaseRateBps >= expansionPurchaseRateBps &&
    listingPressureBps <= expansionListingPressureBps &&
    floorRatioBps >= expansionFloorRatioBps
  ) {
    return "Expansion";
  }

  if (
    purchaseRateBps < weakDemandPurchaseRateBps ||
    listingPressureBps > weakDemandListingPressureBps ||
    floorRatioBps < weakDemandFloorRatioBps
  ) {
    return "WeakDemand";
  }

  return "Stabilization";
}

async function maybeSendDirect(provider, ownerAddress, poolAddress, data) {
  if (process.env.SEND_TX !== "YES") {
    return;
  }

  const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_KEY;
  if (!privateKey) {
    throw new Error("SEND_TX=YES requires PRIVATE_KEY or DEPLOYER_KEY");
  }

  const signer = new Wallet(privateKey, provider);
  const signerAddress = normalizeAddress(signer.address);
  if (signerAddress !== ownerAddress) {
    throw new Error(`Direct send signer ${signerAddress} is not the current owner ${ownerAddress}`);
  }

  const tx = await signer.sendTransaction({ to: poolAddress, data, value: 0 });
  console.log("");
  console.log(`Submitted direct owner tx: ${tx.hash}`);
  await tx.wait();
  console.log("Direct owner tx confirmed.");
}

async function main() {
  const action = process.argv[2];
  if (!action || !["snapshot", "manual-on", "manual-off"].includes(action)) {
    throw new Error(
      [
        "Usage:",
        "  node scripts/market-keeper.js manual-on <deployment.json|networkOrChainId> <durationSeconds>",
        "  node scripts/market-keeper.js manual-off <deployment.json|networkOrChainId>",
        '  node scripts/market-keeper.js snapshot <deployment.json|networkOrChainId> <sales24h> <activeListings> <externalFloorEthOrWei>',
        "",
        "Examples:",
        "  RPC_URL=https://1rpc.io/sepolia node scripts/market-keeper.js manual-on deployment-11155111.json 3600",
        "  RPC_URL=https://1rpc.io/sepolia node scripts/market-keeper.js manual-off deployment-11155111.json",
        "  RPC_URL=https://1rpc.io/sepolia node scripts/market-keeper.js snapshot deployment-11155111.json 35 800 0.012",
      ].join("\n")
    );
  }

  const selector = process.argv[3];
  if (!selector) {
    throw new Error("Missing deployment selector. Pass deployment JSON filename or network/chainId.");
  }
  const maybeFile = selector.endsWith(".json") ? selector : "";
  const maybeNetwork = maybeFile ? "" : selector;
  const firstArgIndex = 4;
  const { filename, json } = readDeployment(maybeFile, maybeNetwork);

  const rpcUrl =
    process.env.RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    (json.appConfig && json.appConfig.rpcUrl) ||
    "";

  if (!rpcUrl) {
    throw new Error("Missing RPC URL. Set RPC_URL or store rpcUrl in deployment JSON.");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const poolAddress = normalizeAddress(json.collection ? json.collection.pool : json.pool);
  const nftAddress = normalizeAddress(json.collection ? json.collection.nft : json.nft);

  const pool = new Contract(poolAddress, loadArtifact("PixelPool"), provider);
  const nft = new Contract(nftAddress, loadArtifact("OnChainPixelNFT"), provider);
  const ownerAddress = normalizeAddress(await pool.owner());
  const ownerCode = await provider.getCode(ownerAddress);
  const currentState = MARKET_STATES[Number(await pool.marketState())] || "Unknown";
  const protocolFloor = await pool.getFloorPrice();
  const referenceSupply = await nft.maxSupply();
  const nowBlock = await provider.getBlock("latest");
  const launchTimestamp = await pool.launchTimestamp();
  const launchProtection = await pool.LAUNCH_PROTECTION();
  const poolPaused = await pool.paused();
  const manualSnapshotExpiresAt = await pool.manualSnapshotExpiresAt();
  let listingVaultAddress = "";
  let listingVenuePaused = false;
  try {
    listingVaultAddress = await pool.listingVault();
    if (listingVaultAddress && listingVaultAddress !== ZeroAddress) {
      const market = new Contract(listingVaultAddress, loadArtifact("PixelMarketplace"), provider);
      listingVenuePaused = await market.paused();
    }
  } catch {}

  console.log(`Keeper action: ${action}`);
  console.log(`Deployment:    ${filename}`);
  console.log(`Pool:          ${poolAddress}`);
  console.log(`Owner:         ${ownerAddress} ${ownerCode === "0x" ? "(EOA)" : "(contract / Safe)"}`);
  console.log(`Protocol floor:${fmtEth(protocolFloor)}`);
  console.log(`Reference supply: ${referenceSupply.toString()}`);
  console.log(`Current state: ${currentState}`);
  console.log(`Pool paused:   ${poolPaused}`);
  console.log(`Venue paused:  ${listingVenuePaused}`);
  console.log(`Manual mode:   ${manualSnapshotExpiresAt > 0n ? `until ${manualSnapshotExpiresAt.toString()}` : "off"}`);

  if (action === "manual-on") {
    const durationRaw = process.argv[firstArgIndex];
    if (!durationRaw) {
      throw new Error("manual-on requires <durationSeconds>");
    }
    const durationSeconds = BigInt(durationRaw);
    const data = pool.interface.encodeFunctionData("enableManualSnapshotMode", [durationSeconds]);

    console.log("");
    console.log("Safe transaction payload");
    console.log(JSON.stringify(
      toSafeTx(
        poolAddress,
        data,
        `Enable manual market snapshot mode for ${durationSeconds.toString()} seconds`
      ),
      null,
      2
    ));

    await maybeSendDirect(provider, ownerAddress, poolAddress, data);
    return;
  }

  if (action === "manual-off") {
    const data = pool.interface.encodeFunctionData("disableManualSnapshotMode", []);

    console.log("");
    console.log("Safe transaction payload");
    console.log(JSON.stringify(
      toSafeTx(
        poolAddress,
        data,
        "Disable manual market snapshot mode"
      ),
      null,
      2
    ));

    await maybeSendDirect(provider, ownerAddress, poolAddress, data);
    return;
  }

  if (action === "snapshot") {
    const sales24hRaw = process.argv[firstArgIndex];
    const activeListingsRaw = process.argv[firstArgIndex + 1];
    const externalFloorRaw = process.argv[firstArgIndex + 2];
    if (!sales24hRaw || !activeListingsRaw || !externalFloorRaw) {
      throw new Error("snapshot requires <sales24h> <activeListings> <externalFloorEthOrWei>");
    }

    const sales24h = BigInt(sales24hRaw);
    const activeListings = BigInt(activeListingsRaw);
    const externalFloor = parsePriceInput(externalFloorRaw);
    const purchaseRateBps = referenceSupply === 0n ? 0n : (sales24h * 10000n) / referenceSupply;
    const listingPressureBps = referenceSupply === 0n ? 0n : (activeListings * 10000n) / referenceSupply;
    const floorRatioBps = protocolFloor === 0n ? 10000n : (externalFloor * 10000n) / protocolFloor;

    const nextState = predictState({
      now: nowBlock.timestamp,
      launchTimestamp: Number(launchTimestamp),
      launchProtection: Number(launchProtection),
      purchaseRateBps,
      listingPressureBps,
      floorRatioBps,
      expansionPurchaseRateBps: await pool.EXPANSION_PURCHASE_RATE_BPS(),
      expansionListingPressureBps: await pool.EXPANSION_LISTING_PRESSURE_BPS(),
      expansionFloorRatioBps: await pool.EXPANSION_FLOOR_RATIO_BPS(),
      weakDemandPurchaseRateBps: await pool.WEAK_DEMAND_PURCHASE_RATE_BPS(),
      weakDemandListingPressureBps: await pool.WEAK_DEMAND_LISTING_PRESSURE_BPS(),
      weakDemandFloorRatioBps: await pool.WEAK_DEMAND_FLOOR_RATIO_BPS(),
    });

    const data = pool.interface.encodeFunctionData("setExternalMarketSnapshot", [
      sales24h,
      activeListings,
      externalFloor,
    ]);

    console.log("");
    console.log("Snapshot preview");
    console.log(`- Sales 24h:        ${sales24h.toString()}`);
    console.log(`- Active listings:  ${activeListings.toString()}`);
    console.log(`- External floor:   ${fmtEth(externalFloor)}`);
    console.log(`- Purchase rate:    ${purchaseRateBps.toString()} bps`);
    console.log(`- Listing pressure: ${listingPressureBps.toString()} bps`);
    console.log(`- Floor ratio:      ${floorRatioBps.toString()} bps`);
    console.log(`- Predicted state:  ${nextState}`);

    console.log("");
    console.log("Safe transaction payload");
    console.log(JSON.stringify(
      toSafeTx(
        poolAddress,
        data,
        `Update external market snapshot: sales24h=${sales24h.toString()}, activeListings=${activeListings.toString()}, externalFloor=${externalFloor.toString()}`
      ),
      null,
      2
    ));

    await maybeSendDirect(provider, ownerAddress, poolAddress, data);
    return;
  }

}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
