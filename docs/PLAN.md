# OnChainPixel Plan

## Current Direction

OnChainPixel is no longer just an experiment around a fully on-chain pixel NFT standard.

The active product direction is:

- fully on-chain pixel NFTs stored with `SSTORE2`
- a native `floor liquidity` engine for the collection
- a two-pool reserve model:
  - `Liquidity Pool` for instant floor exits
  - `Treasury Pool` for selective inventory retirement and supply contraction

The protocol should be understood as:

- an on-chain art collection primitive
- a market-state-aware NFT AMM
- a collection design where community determines premium pricing and the protocol supplies floor liquidity

It should **not** be treated as:

- guaranteed profit after mint
- permanent unconditional floor defense
- an on-chain rarity oracle

## Official V1 Math

### Reserve Split

Mint proceeds are split into:

- `60%` -> Liquidity Pool reserve
- `10%` -> Treasury reserve
- `30%` -> Creator / development / operations

This creates two separate balance sheets:

- `ethBalance` backs liquidity operations
- `treasuryBalance` backs selective treasury actions

Treasury must not be treated as implicit exit liquidity.

### Liquidity Floor

The protocol floor is:

`F = max(F_curve(s), alpha * F_ema)`

Where:

- `F_curve(s)` is the linear bid curve based on net user sells into the pool
- `F_ema` is the smoothed floor baseline
- `alpha = 0.50`

Current v1 parameters:

- `INITIAL_BID_BPS = 6000`
- `MIN_BID_BPS = 1500`
- `BID_DECAY_SELLS = 3000`
- `EMA_FLOOR_BPS = 5000`

Meaning:

- initial floor bid = `60%` of mint price
- minimum curve bid = `15%` of mint price
- the linear decay reaches the minimum after `3000` net sells into the pool
- the floor can also be lifted by `50%` of the smoothed floor baseline

This keeps the floor responsive to market appreciation without letting the pool blindly chase the market.

Important interpretation:

- user sells into pool increase sell pressure
- user buys from pool reduce sell pressure
- treasury buyback reduces sell pressure
- internal vault relists do not create new sell pressure

### Ask Price

The pool only sells inventory in `Stabilization`.

Current v1 formula:

`ask = floor * 1.20`

Current v1 parameter:

- `STABILIZATION_SPREAD_BPS = 2000`

The `20%` spread compensates for:

- inventory risk
- rarity uncertainty
- market-making service

### Market States

The pool operates in three states:

#### Expansion

Meaning:

- launch or growth phase
- market still discovering itself

Behaviour:

- selling into the pool is restricted
- pool inventory selling is disabled

#### Stabilization

Meaning:

- volume is healthy enough
- floor is near baseline
- buy and sell pressure are reasonably balanced

Behaviour:

- selling into the pool is enabled
- buying from pool inventory is enabled
- ask uses `20%` spread

#### WeakDemand

Meaning:

- short-term activity weakens
- sell pressure dominates
- floor trades below baseline

Behaviour:

- inventory selling is disabled
- reserve protection is prioritized
- treasury buyback may be enabled

### Inventory Bands

The liquidity pool uses inventory targets:

- `INVENTORY_LOW = 50`
- `INVENTORY_TARGET = 150`
- `INVENTORY_HIGH = 300`

Interpretation:

- below `50`: inventory is scarce, treasury should not remove more
- around `150`: healthy working inventory
- above `300`: excess inventory, treasury retirement becomes valid

### Treasury Buyback

Treasury is not an always-on support machine.

Its job is to retire excess or stale liquidity inventory and, over time, reduce supply.

Buyback can activate when at least one structural condition is true:

- liquidity pool inventory is above `INVENTORY_HIGH`
- oldest pool inventory is older than `7 days`
- market is in `WeakDemand` and floor is below `90%` of smoothed baseline

And when reserve health is still acceptable.

Current v1 parameters:

- `WEAK_DEMAND_BETA_BPS = 9000`
- `INVENTORY_STALE_AGE = 7 days`
- `BUYBACK_STEP_TREASURY_BPS = 500`
- `BUYBACK_STEP_POOL_BPS = 500`

Important accounting rule:

When treasury buys inventory from the liquidity pool:

- `treasuryBalance` decreases
- `ethBalance` increases
- NFT moves from pool inventory into vault / burn path

This means treasury recapitalizes the liquidity pool instead of silently destroying internal value.

### Burn Path

Treasury inventory is not meant to sit forever.

Current v1 policy:

- treasury-acquired NFTs can be held in vault temporarily
- aged treasury inventory is eligible for burn after `14 days`

Current v1 parameter:

- `VAULT_BURN_AGE = 14 days`

This turns treasury buybacks into a real supply sink.
The current contract now uses a real protocol burn path at the NFT layer, so burn is reflected as actual ERC-721 supply reduction rather than transfer to a dead address.

### Relist Policy

Relist remains a secondary feature, not a core promise.

Relist is only valid when:

- market state is `Stabilization`
- pool inventory is below `INVENTORY_LOW`
- current ask is at least `20%` above treasury cost basis

This keeps relist from constantly re-inflating supply during weak conditions.
It also means relist should affect available inventory, but not the sell-pressure variable used by the floor curve.

## MVP Scope

### In Scope

- `OnChainPixelNFT`
- `PixelPool`
- `PixelRouter`
- `SSTORE2`, `PixelDecoder`, `SVGRenderer`
- router-based mint flow
- pool + treasury split
- linear floor curve
- EMA-supported floor minimum
- market-state engine
- `20%` ask spread in `Stabilization`
- staking fee participation
- selective treasury buyback
- vault storage and aged burn path
- `buySpecific`
- basic frontend prototypes
- core docs

### Out Of Scope For MVP

- advanced launchpad positioning as the main product narrative
- polished analytics stack / subgraph / SDK
- deeply optimized relist strategy
- rarity-aware pricing layer
- production-grade frontend dashboard
- full multi-collection factory workflow as a launch requirement

`PixelFactory` may remain in the repository, but the protocol thesis does not depend on it for MVP validation.

## Active Contract Set

The current active codebase is:

- `contracts/OnChainPixelNFT.sol`
- `contracts/PixelPool.sol`
- `contracts/PixelRouter.sol`
- `contracts/PixelFactory.sol`
- `contracts/interfaces/IOnChainPixel.sol`
- `contracts/libraries/SSTORE2.sol`
- `contracts/libraries/PixelDecoder.sol`
- `contracts/libraries/SVGRenderer.sol`

The repository also contains:

- `scripts/deploy.js`
- `frontend/`
- `test/`
- `archive/generated/` for old generated or duplicate code

`archive/generated/` is not part of the active source of truth.

## Immediate Priorities

### 1. Finalize Product Rules

- confirm market-state thresholds as official policy
- confirm launch protection assumptions
- confirm whether relist remains active in v1 or stays optional
- confirm UI behaviour when pool buy/sell is unavailable

### 2. Finalize Contract Surface

- review `PixelPool` for leftover edge-case complexity
- review router sell flow and approval path
- confirm whether `PixelFactory` is first-class v1 or secondary tooling

### 3. Build And Test Infrastructure

- create a real compile pipeline
- choose Hardhat or Foundry as the canonical toolchain
- add deployment-ready project config
- replace legacy tests with new pool/router-focused tests

### 4. Write The Real Test Matrix

Minimum required test areas:

- NFT minting and pixel storage
- router mint split
- floor bid calculations
- market-state transitions
- buy/sell gating by regime
- treasury recapitalization accounting
- aged vault burn flow
- staking fee accounting

### 5. Tighten Public Documentation

- keep `GITBOOK.md`, `AMM_ARCHITECTURE.md`, and `AUDIT.md` aligned with code
- make sure public docs describe floor liquidity, not guaranteed appreciation
- make sure all docs use the two-pool model consistently

## Success Criteria For V1

V1 is successful when the project can demonstrate all of the following:

- pixel NFTs mint and render fully on-chain
- router splits mint proceeds correctly
- liquidity pool provides conditional instant floor liquidity
- floor math remains bounded and reserve-aware
- treasury actions are explicit and auditable
- aged treasury inventory can reduce supply through burn
- docs, code, and tests describe the same protocol

At that point the project becomes a coherent protocol, not just a promising idea.
