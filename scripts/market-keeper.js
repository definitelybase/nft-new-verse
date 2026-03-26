const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

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
  return ethers.utils.getAddress(value);
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
    return ethers.BigNumber.from(value);
  }
  if (value.includes(".")) {
    return ethers.utils.parseEther(value);
  }
  return ethers.BigNumber.from(value);
}

function fmtEth(value) {
  return `${ethers.utils.formatEther(value)} ETH`;
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
    purchaseRateBps.gte(expansionPurchaseRateBps) &&
    listingPressureBps.lte(expansionListingPressureBps) &&
    floorRatioBps.gte(expansionFloorRatioBps)
  ) {
    return "Expansion";
  }

  if (
    purchaseRateBps.lt(weakDemandPurchaseRateBps) ||
    listingPressureBps.gt(weakDemandListingPressureBps) ||
    floorRatioBps.lt(weakDemandFloorRatioBps)
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

  const signer = new ethers.Wallet(privateKey, provider);
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
  if (!action || !["snapshot", "confirm-sale"].includes(action)) {
    throw new Error(
      [
        "Usage:",
        '  node scripts/market-keeper.js snapshot <deployment.json|networkOrChainId> <sales24h> <activeListings> <externalFloorEthOrWei>',
        '  node scripts/market-keeper.js confirm-sale <deployment.json|networkOrChainId> <tokenId> <salePriceEthOrWei>',
        "",
        "Examples:",
        "  RPC_URL=https://1rpc.io/sepolia node scripts/market-keeper.js snapshot deployment-11155111.json 35 800 0.012",
        "  RPC_URL=https://1rpc.io/sepolia node scripts/market-keeper.js confirm-sale deployment-11155111.json 42 0.0135",
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

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const poolAddress = normalizeAddress(json.collection ? json.collection.pool : json.pool);
  const nftAddress = normalizeAddress(json.collection ? json.collection.nft : json.nft);

  const pool = new ethers.Contract(poolAddress, loadArtifact("PixelPool"), provider);
  const nft = new ethers.Contract(nftAddress, loadArtifact("OnChainPixelNFT"), provider);
  const ownerAddress = normalizeAddress(await pool.owner());
  const ownerCode = await provider.getCode(ownerAddress);
  const currentState = MARKET_STATES[Number(await pool.marketState())] || "Unknown";
  const protocolFloor = await pool.getFloorPrice();
  const referenceSupply = await nft.maxSupply();
  const nowBlock = await provider.getBlock("latest");
  const launchTimestamp = await pool.launchTimestamp();
  const launchProtection = await pool.LAUNCH_PROTECTION();

  console.log(`Keeper action: ${action}`);
  console.log(`Deployment:    ${filename}`);
  console.log(`Pool:          ${poolAddress}`);
  console.log(`Owner:         ${ownerAddress} ${ownerCode === "0x" ? "(EOA)" : "(contract / Safe)"}`);
  console.log(`Protocol floor:${fmtEth(protocolFloor)}`);
  console.log(`Reference supply: ${referenceSupply.toString()}`);
  console.log(`Current state: ${currentState}`);

  if (action === "snapshot") {
    const sales24hRaw = process.argv[firstArgIndex];
    const activeListingsRaw = process.argv[firstArgIndex + 1];
    const externalFloorRaw = process.argv[firstArgIndex + 2];
    if (!sales24hRaw || !activeListingsRaw || !externalFloorRaw) {
      throw new Error("snapshot requires <sales24h> <activeListings> <externalFloorEthOrWei>");
    }

    const sales24h = ethers.BigNumber.from(sales24hRaw);
    const activeListings = ethers.BigNumber.from(activeListingsRaw);
    const externalFloor = parsePriceInput(externalFloorRaw);
    const purchaseRateBps = referenceSupply.isZero() ? ethers.constants.Zero : sales24h.mul(10000).div(referenceSupply);
    const listingPressureBps = referenceSupply.isZero() ? ethers.constants.Zero : activeListings.mul(10000).div(referenceSupply);
    const floorRatioBps = protocolFloor.isZero() ? ethers.BigNumber.from(10000) : externalFloor.mul(10000).div(protocolFloor);

    const nextState = predictState({
      now: nowBlock.timestamp,
      launchTimestamp: launchTimestamp.toNumber(),
      launchProtection: launchProtection.toNumber(),
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

  const tokenIdRaw = process.argv[firstArgIndex];
  const salePriceRaw = process.argv[firstArgIndex + 1];
  if (!tokenIdRaw || !salePriceRaw) {
    throw new Error("confirm-sale requires <tokenId> <salePriceEthOrWei>");
  }

  const tokenId = ethers.BigNumber.from(tokenIdRaw);
  const salePrice = parsePriceInput(salePriceRaw);
  const pending = await pool.pendingExternalSale(tokenId);
  const fromPoolInventory = pending ? await pool.pendingExternalSaleFromPool(tokenId) : false;

  console.log("");
  console.log("Manual sale confirmation preview");
  console.log(`- Token ID:         ${tokenId.toString()}`);
  console.log(`- Sale price:       ${fmtEth(salePrice)}`);
  console.log(`- Pending tracked:  ${pending}`);
  console.log(`- From pool entry:  ${pending ? String(fromPoolInventory) : "n/a"}`);

  const data = pool.interface.encodeFunctionData("confirmExternalSale", [
    tokenId,
    salePrice,
  ]);

  console.log("");
  console.log("Safe transaction payload");
  console.log(JSON.stringify(
    toSafeTx(
      poolAddress,
      data,
      `Confirm manual sale settlement for token ${tokenId.toString()} at ${salePrice.toString()}`
    ),
    null,
    2
  ));

  if (!pending) {
    console.log("");
    console.log("Warning: token is not currently marked as pendingExternalSale on-chain.");
  }

  await maybeSendDirect(provider, ownerAddress, poolAddress, data);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
