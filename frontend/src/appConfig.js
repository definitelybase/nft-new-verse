// Fill these with deployed contract addresses.
// When poolAddress is empty, the UI stays in preview mode.
// rpcUrl is used as a fallback when no wallet is connected.
//
// For local Hardhat testing:
//   1. npm run node
//   2. node scripts/deploy.js
//   3. Paste the addresses below
//
// For testnet / mainnet:
//   Use the addresses from your deployment output and a public RPC.

export const APP_CONFIG = Object.freeze({
  poolAddress: "",
  routerAddress: "",
  nftAddress: "",
  rpcUrl: "",
  // Approximate ETH/USD for display. Not used for transactions.
  ethUsd: "2000",
});
