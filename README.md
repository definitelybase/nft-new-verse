# OnChainPixel

OnChainPixel is a fully on-chain pixel NFT protocol with a reserve-backed floor exit lane and a native on-chain marketplace.

This repository contains the full V1 stack:

- a fully on-chain NFT contract that stores pixel payloads with `SSTORE2`
- a router that handles mint and sell-to-pool flows
- a floor-liquidity pool that tracks reserve health, sell pressure, staking, and buyback logic
- a native marketplace for user listings and protocol inventory listings
- a factory that can deploy the full stack for a collection
- a frontend shell for mint, market, staking, and editor flows

## Read This First

If you want to understand the project quickly, read the docs in this order:

1. [docs/GITBOOK.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/GITBOOK.md)  
   Plain-language product overview.
2. [docs/AMM_ARCHITECTURE.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/AMM_ARCHITECTURE.md)  
   Exact protocol mechanics, money flows, and market rules.
3. [docs/AUDIT.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/AUDIT.md)  
   Transparent risk, trust, and readiness status.
4. [docs/EMERGENCY-GOVERNANCE.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/EMERGENCY-GOVERNANCE.md)  
   Owner powers, Safe flow, and incident response.
5. [docs/PLAN.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/PLAN.md)  
   Current roadmap and what remains before public launch.

Technical NFT-standard references:

- [docs/SPEC.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/SPEC.md)
- [docs/EIP.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/EIP.md)

## What The Protocol Does

OnChainPixel combines three layers that are usually separate:

1. **Art layer**  
   The NFT art is stored fully on-chain. Each token stores packed pixel data and renders its own SVG in the contract.
2. **Floor-liquidity layer**  
   The pool gives holders an on-chain floor exit when reserve coverage and market conditions allow it.
3. **Market layer**  
   Trading is intended to happen in the native marketplace shipped in this repository, not on an external marketplace.

The protocol does **not** try to calculate the fair rarity price of every NFT.  
It only tries to provide a reserve-aware floor lane and let the market decide which pieces deserve a premium.

## Main Contracts

- [contracts/OnChainPixelNFT.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/OnChainPixelNFT.sol)  
  ERC-721 collection contract, palette, on-chain storage, SVG rendering, protocol burn.
- [contracts/PixelRouter.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelRouter.sol)  
  Mint entry point, reserve seeding, sell-to-pool convenience layer.
- [contracts/PixelPool.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelPool.sol)  
  Floor pricing, sell lane, staking, buyback, market state, protocol inventory handling.
- [contracts/PixelMarketplace.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelMarketplace.sol)  
  Native marketplace for user listings and protocol listings. Also exposes market signals back to the pool.
- [contracts/PixelFactory.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelFactory.sol)  
  Deploys the full collection stack: NFT + Pool + Router + Marketplace.

## High-Level Lifecycle

### Mint

The normal mint path is:

1. A user prepares a packed pixel payload.
2. The user calls `PixelRouter.mint(...)`.
3. The router mints the NFT to the user.
4. The mint payment is split between:
   - pool reserve
   - treasury reserve
   - creator / protocol operations
5. The pool updates `totalMinted`.

Default economic intent:

- `60%` to pool reserve
- `10%` to treasury reserve
- `30%` to creator / protocol operations

The exact split is configurable in the router.

### Sell To Pool

When pool buying is enabled:

1. Holder approves the router.
2. Router transfers the NFT into the pool.
3. Pool pays the current floor bid minus trade fee.
4. The NFT enters protocol inventory.
5. Sell pressure increases.

### Native Marketplace

The marketplace supports two kinds of listings:

- **user listings**  
  Normal peer-to-peer listings created by holders.
- **protocol listings**  
  Listings created automatically when the pool releases inventory into the marketplace.

When protocol inventory sells:

1. The marketplace takes payment.
2. Marketplace fee is routed into the pool fee splitter.
3. Sale proceeds are settled back into the pool or treasury.
4. Sell pressure is only reduced after the real sale happens.

That last point matters: protocol inventory is not considered "cleared" just because it moved into a listing contract.

### Treasury Buyback

The treasury can buy back stale or excess protocol inventory under guarded conditions.

Buyback is not meant to promise permanent support.  
It exists to keep the system from becoming a warehouse of stale inventory when market conditions weaken.

### Staking

Holders can stake NFTs into the pool and earn part of trade fees.  
Staking rewards come from trading activity, not from inflationary token emissions.

## Source Of Truth Folders

Primary project folders:

- [contracts](/Users/daniltkacev/Downloads/nft%20ponzo/contracts)
- [docs](/Users/daniltkacev/Downloads/nft%20ponzo/docs)
- [scripts](/Users/daniltkacev/Downloads/nft%20ponzo/scripts)
- [frontend](/Users/daniltkacev/Downloads/nft%20ponzo/frontend)
- [frontend/src](/Users/daniltkacev/Downloads/nft%20ponzo/frontend/src)
- [hardhat-test](/Users/daniltkacev/Downloads/nft%20ponzo/hardhat-test)

Archived / non-source-of-truth folders:

- [archive/generated](/Users/daniltkacev/Downloads/nft%20ponzo/archive/generated)
- [archive/legacy-tests](/Users/daniltkacev/Downloads/nft%20ponzo/archive/legacy-tests)

## Tooling

- Node: `22.x`
- Hardhat: compile, local deploy, testing
- Vite: frontend shell

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

Run the full Hardhat suite:

```bash
npm test
```

Run the frontend in dev mode:

```bash
npm run frontend:dev
```

Build the frontend:

```bash
npm run frontend:build
```

Start a quick in-process deploy:

```bash
npm run deploy:hardhat
```

Run against a local node:

```bash
npm run node
npm run deploy:local
```

Run a direct Sepolia deploy:

```bash
SEPOLIA_RPC_URL=https://... \
DEPLOYER_KEY=0x... \
OWNER_ADDRESS=0xYourSafe \
CREATOR_ADDRESS=0xCreator \
npx hardhat run scripts/deploy-local.js --network sepolia
```

Run the full factory deploy path:

```bash
SEPOLIA_RPC_URL=https://... \
DEPLOYER_KEY=0x... \
OWNER_ADDRESS=0xYourSafe \
CREATOR_ADDRESS=0xCreator \
node scripts/deploy.js sepolia
```

Verify a deployment:

```bash
RPC_URL=https://... npm run verify:deploy -- deployment-11155111.json
```

Transfer ownership to a Safe:

```bash
NEW_OWNER_ADDRESS=0xYourSafe npx hardhat run scripts/transfer-ownership.js --network sepolia
```

Prepare a manual market payload:

```bash
RPC_URL=https://... npm run keeper:market -- snapshot deployment-11155111.json 35 800 0.012
```

## Deployment Artifacts

`npm run build` exports:

- [build/OnChainPixelNFT.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/OnChainPixelNFT.abi)
- [build/OnChainPixelNFT.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/OnChainPixelNFT.bin)
- [build/PixelPool.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelPool.abi)
- [build/PixelPool.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelPool.bin)
- [build/PixelRouter.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelRouter.abi)
- [build/PixelRouter.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelRouter.bin)
- [build/PixelMarketplace.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelMarketplace.abi)
- [build/PixelMarketplace.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelMarketplace.bin)
- [build/PixelFactory.abi](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelFactory.abi)
- [build/PixelFactory.bin](/Users/daniltkacev/Downloads/nft%20ponzo/build/PixelFactory.bin)

## Current Status

Current repository status:

- native marketplace flow implemented
- protocol listings auto-settle back into the pool
- router change delay implemented after launch protection
- palette lock + Safe ownership handoff flow implemented
- Hardhat suite currently passes

Important transparency points:

- this is **not** an audited mainnet-ready system yet
- the current frontend is still a product shell, not a finished production client
- the protocol still depends on owner / Safe operations for some configuration and fallback flows

For a full transparent status read:

- [docs/AUDIT.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/AUDIT.md)
- [docs/EMERGENCY-GOVERNANCE.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/EMERGENCY-GOVERNANCE.md)
- [docs/PLAN.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/PLAN.md)

## Frontend App Config

Frontend network and contract addresses live in:

- [frontend/src/appConfig.js](/Users/daniltkacev/Downloads/nft%20ponzo/frontend/src/appConfig.js)

The deploy scripts print a ready-to-paste `APP_CONFIG` block after a successful deployment.
