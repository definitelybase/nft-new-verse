# OnChainPixel

OnChainPixel is a fully on-chain pixel NFT project with a native NFT floor-liquidity pool.

The current repository contains:

- an on-chain pixel NFT contract
- a market-state-aware liquidity pool
- a router for mint and trading flows
- a factory for deploying a full collection stack
- Hardhat build and test setup

## Source Of Truth

Active project folders:

- [contracts](/Users/daniltkacev/Downloads/nft%20ponzo/contracts)
- [docs](/Users/daniltkacev/Downloads/nft%20ponzo/docs)
- [scripts](/Users/daniltkacev/Downloads/nft%20ponzo/scripts)
- [frontend](/Users/daniltkacev/Downloads/nft%20ponzo/frontend)
- [frontend/src](/Users/daniltkacev/Downloads/nft%20ponzo/frontend/src)
- [hardhat-test](/Users/daniltkacev/Downloads/nft%20ponzo/hardhat-test)

Archived / non-source-of-truth content:

- [archive/generated](/Users/daniltkacev/Downloads/nft%20ponzo/archive/generated)
- [archive/legacy-tests](/Users/daniltkacev/Downloads/nft%20ponzo/archive/legacy-tests)

## Main Contracts

- [contracts/OnChainPixelNFT.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/OnChainPixelNFT.sol)
- [contracts/PixelPool.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelPool.sol)
- [contracts/PixelRouter.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelRouter.sol)
- [contracts/PixelFactory.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelFactory.sol)

## Tooling

- Node: `22.x`
- Hardhat: build, compile, and test runner

Project files:

- [package.json](/Users/daniltkacev/Downloads/nft%20ponzo/package.json)
- [hardhat.config.js](/Users/daniltkacev/Downloads/nft%20ponzo/hardhat.config.js)
- [vite.config.js](/Users/daniltkacev/Downloads/nft%20ponzo/vite.config.js)
- [.nvmrc](/Users/daniltkacev/Downloads/nft%20ponzo/.nvmrc)

## Commands

Install dependencies:

```bash
npm install
```

Compile contracts and export deploy artifacts:

```bash
npm run build
```

Run the Hardhat test suite:

```bash
npm test
```

Run the frontend dev shell:

```bash
npm run frontend:dev
```

Build the frontend shell:

```bash
npm run frontend:build
```

## Current Test Coverage

The live Hardhat tests cover:

- wiring and mint flow through router
- pool reserve and treasury split
- exact mint payment checks
- sell / buySpecific flows
- buyback, vault, relist, and burn behaviour
- market-state thresholds and negative gates
- market-state stress and solvency checks
- staking fee accounting and edge cases
- protocol-fee/admin-path invariants
- factory and NFT admin access / withdraw paths
- factory end-to-end collection deployment

## Deployment Artifacts

`npm run build` exports:

- [build/OnChainPixelNFT.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/OnChainPixelNFT.abi)
- [build/OnChainPixelNFT.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/OnChainPixelNFT.bin)
- [build/PixelPool.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelPool.abi)
- [build/PixelPool.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelPool.bin)
- [build/PixelRouter.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelRouter.abi)
- [build/PixelRouter.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelRouter.bin)
- [build/PixelFactory.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelFactory.abi)
- [build/PixelFactory.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelFactory.bin)

These artifacts are consumed by [scripts/deploy.js](/Users/daniltkacev/Downloads/nft%20ponzo/scripts/deploy.js).

## Notes

- The protocol docs are in [docs/PLAN.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/PLAN.md), [docs/AMM_ARCHITECTURE.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/AMM_ARCHITECTURE.md), and [docs/AUDIT.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/AUDIT.md).
- The frontend files are still prototypes and not yet a production UI.

## Frontend App Config

Frontend addresses and read settings live in [frontend/src/appConfig.js](/Users/daniltkacev/Downloads/nft%20ponzo/frontend/src/appConfig.js).

Fill these once in code:

```js
export const APP_CONFIG = Object.freeze({
  poolAddress: "0xYourPoolAddress",
  routerAddress: "0xYourRouterAddress",
  nftAddress: "0xYourNftAddress",
  rpcUrl: "https://your-mainnet-rpc.example",
  ethUsd: "2000",
});
```

If `poolAddress` is empty, the UI stays in preview mode. `rpcUrl` should point to Ethereum mainnet.
