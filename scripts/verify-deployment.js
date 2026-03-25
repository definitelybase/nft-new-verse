const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

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
  return ethers.utils.getAddress(value);
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
  const expectedOwner = normalizeAddress(json.owner);
  const expectedCreator = normalizeAddress(json.creator);
  const hasFactory = Boolean(json.factory);
  const factoryAddress = hasFactory ? normalizeAddress(json.factory) : "";

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const nft = new ethers.Contract(nftAddress, loadArtifact("OnChainPixelNFT"), provider);
  const pool = new ethers.Contract(poolAddress, loadArtifact("PixelPool"), provider);
  const router = new ethers.Contract(routerAddress, loadArtifact("PixelRouter"), provider);
  const factory = hasFactory
    ? new ethers.Contract(factoryAddress, loadArtifact("PixelFactory"), provider)
    : null;

  const failures = [];

  console.log(`Checking deployment file: ${filename}`);
  console.log(`NFT:    ${nftAddress}`);
  console.log(`Pool:   ${poolAddress}`);
  console.log(`Router: ${routerAddress}`);
  if (factoryAddress) console.log(`Factory:${factoryAddress}`);
  console.log(`Owner:  ${expectedOwner}`);
  console.log(`Creator:${expectedCreator}`);
  console.log("");

  const nftOwner = normalizeAddress(await nft.owner());
  const poolOwner = normalizeAddress(await pool.owner());
  const routerOwner = normalizeAddress(await router.owner());
  const poolRouter = normalizeAddress(await pool.router());
  const routerCreator = normalizeAddress(await router.creator());
  const routerIsMinter = await nft.isMinter(routerAddress);
  const poolIsBurner = await nft.isBurner(poolAddress);
  const paletteLocked = await nft.paletteLocked();
  const pendingRouter = await pool.pendingRouter();
  const pendingRouterEta = await pool.pendingRouterEta();

  check("NFT owner", nftOwner === expectedOwner, `${nftOwner}`, failures);
  check("Pool owner", poolOwner === expectedOwner, `${poolOwner}`, failures);
  check("Router owner", routerOwner === expectedOwner, `${routerOwner}`, failures);
  if (factory) {
    const factoryOwner = normalizeAddress(await factory.owner());
    check("Factory owner", factoryOwner === expectedOwner, `${factoryOwner}`, failures);
  }

  check("Router set on pool", poolRouter === routerAddress, `${poolRouter}`, failures);
  check("Router is NFT minter", routerIsMinter, `${routerIsMinter}`, failures);
  check("Pool is NFT burner", poolIsBurner, `${poolIsBurner}`, failures);
  check("Router creator", routerCreator === expectedCreator, `${routerCreator}`, failures);
  check("Palette locked", paletteLocked === true, `${paletteLocked}`, failures);
  check(
    "No pending router change",
    pendingRouter === ethers.constants.AddressZero && pendingRouterEta.eq(0),
    `${pendingRouter} / eta ${pendingRouterEta.toString()}`,
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
