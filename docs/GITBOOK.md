# OnChainPixel

## Introduction

OnChainPixel combines two ideas in one protocol:

- fully on-chain pixel NFTs stored with `SSTORE2`
- a native NFT floor-liquidity pool

The goal is not to promise that every NFT can always be sold at a "fair" price.  
The goal is to provide a transparent on-chain `floor bid layer` so holders are not forced into pure peer-to-peer illiquidity.

In other words:

- the NFT remains a unique asset
- the community decides which pieces deserve a premium
- the protocol provides instant floor liquidity when market conditions allow it

## Core Positioning

OnChainPixel should be understood as:

- an on-chain art standard
- an NFT collection launcher
- a market-state-aware floor pool

It should **not** be positioned as:

- guaranteed profit after mint
- permanent bid support at any price
- a protocol that can fairly price rarity on its own

The pool is a `floor market`, not a rarity oracle.

## Mint Economics

Example baseline configuration:

- Supply: `10,000`
- Mint price: `0.01 ETH`
- Pool seed: `60%`
- Treasury: `10%`
- Creator: `30%`

For a fully sold mint:

- `60 ETH` goes to pool reserve
- `10 ETH` goes to treasury reserve
- `30 ETH` goes to creator / team / development

This split is designed to fund:

- immediate reserve-backed floor liquidity
- a separate treasury for selective buyback actions
- sustainable creator funding

## What The Pool Actually Does

The pool does three jobs:

1. It offers a protocol floor bid when selling into the pool is enabled.
2. It sells pool inventory back to the market when selling from inventory is enabled.
3. It tracks market conditions and changes behaviour depending on regime.

This means the pool is not always in the same mode.

## Market States

The pool operates in three states:

### Expansion

This is the launch / growth state.

Typical properties:

- early after mint
- activity is growing
- the collection is still discovering demand

Pool behaviour:

- pool buying is restricted
- pool inventory selling is disabled
- the protocol avoids letting early sellers lean on the reserve too aggressively

This prevents the reserve from being used as an unconditional exit during the exact phase when the collection is trying to form its market.

### Stabilization

This is the normal two-sided market state.

Typical properties:

- volume is stable
- floor is not moving violently
- buy and sell pressure are reasonably balanced

Pool behaviour:

- selling into the pool is enabled
- buying from the pool is enabled
- inventory is sold with a `20% spread` over floor

This is the state where the protocol behaves most like an NFT AMM.

### Weak Demand

This is the defensive state.

Typical properties:

- short-term volume weakens
- sell pressure dominates buy pressure
- floor trades below its smoothed baseline

Pool behaviour:

- pool inventory selling is disabled
- floor support becomes more conservative
- treasury buyback can become available if reserve coverage is healthy

## Pricing Model

The pool does not use the old exponential launch math anymore.

Instead it uses a simpler and more auditable structure:

### Floor Bid

The protocol floor starts as a fraction of mint price and decays linearly as more NFTs are sold into the pool.

Conceptually:

`floor bid = initial bid - decay per net sell`

In this model, `net sell` means user-driven sell pressure into the liquidity pool.
Internal protocol operations like vault relists do not count as fresh sell pressure.

With the current baseline model in code:

- initial bid = `60%` of mint price
- minimum bid = `15%` of mint price
- decay reaches the floor after roughly `3000` net sells into the pool

This creates a predictable and bounded reserve obligation.

### Ask Price

The pool does not always sell inventory.

When the market is in `Stabilization`, ask is:

`ask = floor bid + 20% spread`

That spread exists to:

- protect reserve quality
- avoid trivial round-trip arbitrage
- compensate the pool for inventory risk

## Why The Protocol Does Not Promise Fair Rarity Pricing

NFTs are not fungible. The protocol should not pretend otherwise.

The pool prices NFTs as floor assets.  
Community and secondary market behaviour determine whether some NFTs deserve a premium.

That means:

- rare NFTs can still be repriced by the market after leaving the pool
- common NFTs can still use the pool as instant floor liquidity
- the protocol stays simple and honest

This is a feature, not a failure.  
The protocol provides `floor liquidity`, while the market provides `premium discovery`.

## Buyback Logic

Buyback is no longer framed as automatic permanent floor defense.

It is a conditional treasury action.

Treasury buyback is only allowed when all of these conditions are true:

- market state is `WeakDemand`
- short-term volume is below its longer baseline
- sell pressure is stronger than buy pressure
- current floor is below its smoothed baseline
- reserve coverage remains healthy

This design avoids turning treasury into a blind subsidy for exit liquidity.

When treasury inventory is no longer needed, the protocol can burn it through the NFT contract itself.
That makes supply contraction real at the ERC-721 layer instead of merely sending NFTs to a dead address.

## Trading Fees

Each trade uses a `2.5%` fee.

Current split in the pool:

- `10%` of fee to stakers
- `25%` of fee to pool reserve
- `25%` of fee to treasury
- `40%` of fee to protocol fees

This means trading activity improves:

- reserve depth
- treasury capacity
- staking rewards

without pretending that fees alone solve all liquidity constraints.

## Staking

NFT holders can stake into the pool and earn part of the fee flow.

Functions:

- `stake(tokenId)`
- `unstake(tokenId)`
- `claimFees()`

Staking is designed as fee participation, not as artificial yield disconnected from market activity.

## EMC And Liquidity Metrics

The protocol exposes on-chain market metrics through `getMarketMetrics()`.

The main idea is to track something more honest than naïve `floor × total supply`.

Metrics include:

- effective floor
- circulating supply
- locked supply
- pool inventory
- pool ETH
- effective market cap
- liquidity ratio

This helps users distinguish between headline valuation and actual protocol-backed liquidity.

## Contract Set

### OnChainPixelNFT

Core ERC-721 with:

- `SSTORE2` pixel storage
- per-token canvas dimensions
- global palette
- on-chain SVG rendering
- `mintTo` minter role for router flow

### PixelPool

Floor-liquidity engine with:

- market states
- reserve-aware floor pricing
- external listing releases
- treasury buyback gates
- staking
- pool metrics

### PixelRouter

Main user entry point for:

- minting
- liquidity seeding
- floor-exit sell routing
- surfacing pool state to UI

### PixelFactory

Launchpad contract for deploying:

- NFT
- pool
- router

in one collection flow.

## Product Narrative

The strongest honest narrative for OnChainPixel is:

`Permanent art. Native floor liquidity. Community-priced rarity.`

That framing matches the protocol much better than:

- guaranteed floor growth
- instant profit after mint
- permanent unconditional exit

## Current Priorities

1. Finish aligning all contracts with one build system.
2. Replace legacy tests with Pool/Router-first tests.
3. Rewrite remaining docs to match the new market-state-aware model.
4. Connect the pixel editor and site UI to real contract flows.
5. Validate the reserve math with scenario simulations before any public deployment.
