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
