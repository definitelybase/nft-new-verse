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
  chainId: "11155111",
  poolAddress: "0xB4B0290a80B5c188853feB8b7a130b7E3ac51F2a",
  routerAddress: "0x8689267181AeB402Ce1Bde40Fa1852A1be125a9c",
  nftAddress: "0xFE81A756c27255C32639398710FbAA414Dbed735",
  marketplaceAddress: "0xd27441AeE09561Ea399a178796f4954Ac2986753",
  rpcUrl: "https://1rpc.io/sepolia",
  // Approximate ETH/USD for display. Not used for transactions.
  ethUsd: "2000",
});
