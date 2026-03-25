// Fill these with deployed contract addresses.
// When poolAddress is empty, the UI stays in preview mode.
// rpcUrl is used as a fallback when no wallet is connected.
//
// For local Hardhat testing:
//   1. npm run node                       (terminal 1)
//   2. npm run deploy:local               (terminal 2 — outputs ready-to-paste block)
//   3. Paste the addresses below
//   4. npm run frontend:dev               (terminal 2)
//
// For Sepolia testnet:
//   1. Run the deploy script
//   2. Paste addresses from deployment-11155111.json below
//   3. Set rpcUrl to a public Sepolia RPC

export const APP_CONFIG = Object.freeze({
  poolAddress: "0x21C73708625CcCfAf05C2758dA2Ab199C2A3E36E",
  routerAddress: "0xB25472D7b953E61BD4FCa00f890517F14F8031fa",
  nftAddress: "0x9637A490eE28a4aE0a1Ca2Bc8ad100CFcDC1ADeB",
  rpcUrl: "https://1rpc.io/sepolia",
  // Approximate ETH/USD for display. Not used for transactions.
  ethUsd: "2000",
});
