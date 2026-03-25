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
//   1. npm run build
//   2. PRIVATE_KEY=0x... RPC_URL=https://sepolia... node scripts/deploy.js sepolia
//   3. Paste addresses from deployment-sepolia.json below
//   4. Set rpcUrl to a public Sepolia RPC (e.g. Alchemy/Infura)

export const APP_CONFIG = Object.freeze({
  poolAddress: "",
  routerAddress: "",
  nftAddress: "",
  rpcUrl: "",
  // Approximate ETH/USD for display. Not used for transactions.
  ethUsd: "2000",
});
