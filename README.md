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

Run a quick in-process local deploy:

```bash
npm run deploy:hardhat
```

Run a deploy against a local node:

```bash
npm run node
npm run deploy:local
```

Run a direct deploy on Sepolia through Hardhat config:

```bash
SEPOLIA_RPC_URL=https://... DEPLOYER_KEY=0x... OWNER_ADDRESS=0xYourSafe CREATOR_ADDRESS=0xCreator npx hardhat run scripts/deploy-local.js --network sepolia
```

Run the full factory deploy script:

```bash
npm run build
SEPOLIA_RPC_URL=https://... DEPLOYER_KEY=0x... OWNER_ADDRESS=0xYourSafe CREATOR_ADDRESS=0xCreator node scripts/deploy.js sepolia
```

Verify a live deployment after ownership handoff:

```bash
RPC_URL=https://... npm run verify:deploy -- deployment-11155111.json
```

Transfer ownership of an existing deployment to a Safe:

```bash
NEW_OWNER_ADDRESS=0xYourSafe npx hardhat run scripts/transfer-ownership.js --network sepolia
```

## Current Test Coverage

The live Hardhat tests cover:

- wiring and mint flow through router
- pool reserve and treasury split
- exact mint payment checks
- sell / external listing / external sale-confirmation flows
- buyback, vault, relist, and burn behaviour
- market-state thresholds and negative gates
- market-state stress and solvency checks
- staking fee accounting and edge cases
- protocol-fee/admin-path invariants
- deploy/config guards and constructor validation
- factory and NFT admin access / withdraw paths
- palette lock + ownership handoff to multisig owner
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

## Deployment Paths

There are now two supported deployment paths:

- [scripts/deploy-local.js](/Users/daniltkacev/Downloads/nft%20ponzo/scripts/deploy-local.js)
  Direct deploy of `NFT + Pool + Router`. This is the cheap, practical path for local use and testnets.
- [scripts/deploy.js](/Users/daniltkacev/Downloads/nft%20ponzo/scripts/deploy.js)
  Full factory-based deployment path. Useful when you want to validate the `Factory` flow itself.

Both scripts now print a ready-to-paste `APP_CONFIG` block for the frontend and write a deployment JSON file.

Both scripts also support the safer launch flow:

- `OWNER_ADDRESS` or `SAFE_ADDRESS` for final ownership handoff
- `CREATOR_ADDRESS` for the economic creator address when it differs from deployer
- palette lock enabled by default before ownership handoff
- optional `SKIP_PALETTE_LOCK=YES` only when you intentionally want to keep the palette mutable during setup
- router replacement is immediate only during initial launch protection / setup; after that it must be queued and applied after the on-chain delay

Recommended live rollout:

1. Deploy with `OWNER_ADDRESS=0xYourSafe`
2. Confirm NFT / Pool / Router ownership moved to the Safe
3. Confirm palette is locked
4. Run `npm run verify:deploy -- deployment-11155111.json`

If you accidentally deployed to an EOA owner first, you can still hand off the existing deployment afterwards with `transfer-ownership.js`.

## Safe / Keeper Flow

The pool now expects external market updates from your operator / Safe layer:

- `setExternalMarketSnapshot(sales24h, activeListings, externalFloor)`
- `confirmExternalSale(tokenId, salePrice)`

Use [scripts/market-keeper.js](/Users/daniltkacev/Downloads/nft%20ponzo/scripts/market-keeper.js) to prepare Safe-ready payloads.

Snapshot example:

```bash
RPC_URL="https://1rpc.io/sepolia" \
npm run keeper:market -- snapshot deployment-11155111.json 35 800 0.012
```

External sale confirmation:

```bash
RPC_URL="https://1rpc.io/sepolia" \
npm run keeper:market -- confirm-sale deployment-11155111.json 42 0.0135
```

The script prints:

- current pool owner and whether it is a Safe / contract
- protocol floor and reference supply
- derived market ratios for the snapshot
- a Safe transaction payload with `to`, `value`, and `data`

If the current owner is still an EOA and you intentionally want to send directly, set `SEND_TX=YES` plus `PRIVATE_KEY` or `DEPLOYER_KEY`.

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
