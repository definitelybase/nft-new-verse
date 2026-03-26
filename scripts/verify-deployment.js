const fs = require("fs");
const path = require("path");
const { Contract, JsonRpcProvider, ZeroAddress, getAddress } = require("ethers-v6");

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

function readDeployment(fileArg, networkArg) {
  if (fileArg) {
    return {
      filename: fileArg,
      json: JSON.parse(fs.readFileSync(fileArg, "utf8")),
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

function normalizeAddress(value) {
  return getAddress(value);
}

function check(label, ok, details, failures) {
  if (ok) {
    console.log(`[OK]   ${label}: ${details}`);
    return;
  }
  console.log(`[FAIL] ${label}: ${details}`);
  failures.push(label);
}

async function main() {
  const maybeFile = process.argv[2] && process.argv[2].endsWith(".json") ? process.argv[2] : "";
  const maybeNetwork = maybeFile ? process.argv[3] : process.argv[2];
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

  const nftAddress = normalizeAddress(json.collection ? json.collection.nft : json.nft);
  const poolAddress = normalizeAddress(json.collection ? json.collection.pool : json.pool);
  const routerAddress = normalizeAddress(json.collection ? json.collection.router : json.router);
  const marketAddress = json.collection?.market || json.market
    ? normalizeAddress(json.collection ? json.collection.market : json.market)
    : "";
  const expectedOwner = normalizeAddress(json.owner);
  const expectedCreator = normalizeAddress(json.creator);
  const expectedListingVault = json.listingVault ? normalizeAddress(json.listingVault) : ZeroAddress;
  const hasFactory = Boolean(json.factory);
  const factoryAddress = hasFactory ? normalizeAddress(json.factory) : "";

  const provider = new JsonRpcProvider(rpcUrl);
  const nft = new Contract(nftAddress, loadArtifact("OnChainPixelNFT"), provider);
  const pool = new Contract(poolAddress, loadArtifact("PixelPool"), provider);
  const router = new Contract(routerAddress, loadArtifact("PixelRouter"), provider);
  const market = marketAddress
    ? new Contract(marketAddress, loadArtifact("PixelMarketplace"), provider)
    : null;
  const factory = hasFactory
    ? new Contract(factoryAddress, loadArtifact("PixelFactory"), provider)
    : null;

  const failures = [];

  console.log(`Checking deployment file: ${filename}`);
  console.log(`NFT:    ${nftAddress}`);
  console.log(`Pool:   ${poolAddress}`);
  console.log(`Router: ${routerAddress}`);
  if (marketAddress) console.log(`Market: ${marketAddress}`);
  if (factoryAddress) console.log(`Factory:${factoryAddress}`);
  console.log(`Owner:  ${expectedOwner}`);
  console.log(`Creator:${expectedCreator}`);
  if (json.listingVault) console.log(`Listing:${expectedListingVault}`);
  console.log("");

  const nftOwner = normalizeAddress(await nft.owner());
  const poolOwner = normalizeAddress(await pool.owner());
  const routerOwner = normalizeAddress(await router.owner());
  const marketOwner = market ? normalizeAddress(await market.owner()) : "";
  const poolRouter = normalizeAddress(await pool.router());
  const routerCreator = normalizeAddress(await router.creator());
  const routerIsMinter = await nft.isMinter(routerAddress);
  const poolIsBurner = await nft.isBurner(poolAddress);
  const paletteLocked = await nft.paletteLocked();
  const pendingRouter = await pool.pendingRouter();
  const pendingRouterEta = await pool.pendingRouterEta();
  const poolListingVault = await pool.listingVault();

  check("NFT owner", nftOwner === expectedOwner, `${nftOwner}`, failures);
  check("Pool owner", poolOwner === expectedOwner, `${poolOwner}`, failures);
  check("Router owner", routerOwner === expectedOwner, `${routerOwner}`, failures);
  if (market) {
    check("Market owner", marketOwner === expectedOwner, `${marketOwner}`, failures);
  }
  if (factory) {
    const factoryOwner = normalizeAddress(await factory.owner());
    check("Factory owner", factoryOwner === expectedOwner, `${factoryOwner}`, failures);
  }

  check("Router set on pool", poolRouter === routerAddress, `${poolRouter}`, failures);
  check("Router is NFT minter", routerIsMinter, `${routerIsMinter}`, failures);
  check("Pool is NFT burner", poolIsBurner, `${poolIsBurner}`, failures);
  check("Router creator", routerCreator === expectedCreator, `${routerCreator}`, failures);
  if (json.listingVault) {
    check("Pool listing vault", normalizeAddress(poolListingVault) === expectedListingVault, `${poolListingVault}`, failures);
  }
  check("Palette locked", paletteLocked === true, `${paletteLocked}`, failures);
  check(
    "No pending router change",
    pendingRouter === ZeroAddress && pendingRouterEta === 0n,
    `${pendingRouter} / eta ${String(pendingRouterEta)}`,
    failures
  );

  console.log("");
  if (failures.length > 0) {
    console.log(`Verification failed: ${failures.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("Deployment verification passed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
