require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      gas: "auto",
      blockGasLimit: 30000000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./hardhat-test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 120000
  }
};
