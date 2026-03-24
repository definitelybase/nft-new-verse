const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ARTIFACTS_ROOT = path.join(ROOT, "artifacts", "contracts");
const BUILD_ROOT = path.join(ROOT, "build");

const CONTRACTS = [
  ["OnChainPixelNFT", path.join(ARTIFACTS_ROOT, "OnChainPixelNFT.sol", "OnChainPixelNFT.json")],
  ["PixelPool", path.join(ARTIFACTS_ROOT, "PixelPool.sol", "PixelPool.json")],
  ["PixelRouter", path.join(ARTIFACTS_ROOT, "PixelRouter.sol", "PixelRouter.json")],
  ["PixelFactory", path.join(ARTIFACTS_ROOT, "PixelFactory.sol", "PixelFactory.json")]
];

function loadArtifact(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeBuildArtifact(name, artifact) {
  const abiPath = path.join(BUILD_ROOT, `${name}.abi`);
  const binPath = path.join(BUILD_ROOT, `${name}.bin`);
  const bytecode = (artifact.bytecode || "").replace(/^0x/, "");

  if (!Array.isArray(artifact.abi) || bytecode.length === 0) {
    throw new Error(`Artifact ${name} is missing ABI or bytecode`);
  }

  fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
  fs.writeFileSync(binPath, `${bytecode}\n`);
}

function main() {
  fs.mkdirSync(BUILD_ROOT, { recursive: true });

  for (const [name, filePath] of CONTRACTS) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing Hardhat artifact for ${name}: ${filePath}`);
    }

    const artifact = loadArtifact(filePath);
    writeBuildArtifact(name, artifact);
    console.log(`Exported ${name} -> build/${name}.abi + build/${name}.bin`);
  }
}

main();
