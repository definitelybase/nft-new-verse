# OnChainPixel Architecture

## Design Goal

OnChainPixel is built around a simple separation of roles:

- the NFT contract stores and renders the art
- the router handles mint and sell entry flows
- the pool handles reserve-backed floor exits, staking, buyback, and market state
- the marketplace handles peer-to-peer listings and protocol inventory sales

The system is not trying to do everything with one price.

Instead:

- the pool handles the floor lane
- the marketplace handles premium discovery

## Contract Stack

### OnChainPixelNFT

File:

- [contracts/OnChainPixelNFT.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/OnChainPixelNFT.sol)

Responsibilities:

- stores pixel payloads on-chain with `SSTORE2`
- stores a shared collection palette
- renders SVG fully on-chain
- exposes `tokenURI`
- allows protocol mint and protocol burn roles

Important facts:

- default canvas can be configured
- max canvas size is `64 x 64`
- protocol uses packed pixel data and indexed palette colors
- palette can be locked permanently

### PixelRouter

File:

- [contracts/PixelRouter.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelRouter.sol)

Responsibilities:

- mints through the NFT contract
- splits mint revenue
- seeds pool reserve
- seeds treasury reserve
- forwards creator / ops share
- provides a convenience `sellNFT(...)` path into the pool

Baseline split intent:

- `poolSeedBps = 6000`
- `treasuryBps = 1000`
- remainder goes to creator / protocol operations

### PixelPool

File:

- [contracts/PixelPool.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelPool.sol)

Responsibilities:

- tracks reserve balances
- computes floor price
- accepts sell-to-pool transactions
- tracks protocol inventory
- tracks staking and fee accounting
- handles treasury buyback, vaulting, and burn
- consumes market signals from the native marketplace
- controls whether protocol inventory can be released for listing

### PixelMarketplace

File:

- [contracts/PixelMarketplace.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelMarketplace.sol)

Responsibilities:

- user listings
- protocol listings
- active listing count
- rolling `24h` sales count
- current market floor
- automatic settlement of protocol listings back into the pool

This is the core of the current V1 trading model.

### PixelFactory

File:

- [contracts/PixelFactory.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelFactory.sol)

Responsibilities:

- deploy full stack collections
- upload bytecode for all stack pieces
- create `NFT + Pool + Router + Marketplace`
- wire mint/burn/owner roles correctly

## Reserve Model

The system uses separate balances inside the pool contract:

- `ethBalance`  
  Main pool reserve for floor exits.
- `treasuryBalance`  
  Separate reserve for buyback and inventory management.
- `protocolFees`  
  Protocol-owned fees, not part of user exit coverage.

This separation is intentional.

The protocol does not pretend that all ETH in the system is the same kind of liquidity.

## Mint Flow

Mint flow:

1. User calls `PixelRouter.mint(...)`.
2. Router mints NFT to the user.
3. Router sends part of mint revenue to `pool.seedLiquidity()`.
4. Router sends part to `pool.seedTreasury()`.
5. Router updates `pool.setTotalMinted(...)`.
6. Router sends the remainder to `creator`.

Why this matters:

- floor liquidity is seeded immediately
- treasury is not mixed into user-facing exit liquidity
- creator / ops funding is explicit

## Floor Price Model

Key constants from [contracts/PixelPool.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelPool.sol):

- `INITIAL_BID_BPS = 6000`
- `MIN_BID_BPS = 1500`
- `BID_DECAY_SELLS = 3000`
- `EMA_FLOOR_BPS = 5000`

Interpretation:

- initial floor bid = `60%` of mint price
- hard minimum floor bid = `15%` of mint price
- decay reaches minimum after about `3000` net sells into the pool
- EMA floor guard contributes `50%` of the smoothed floor baseline

The pool computes two candidates:

1. curve bid  
   Linear decay from initial bid to minimum bid as `totalSoldIntoPool` rises.
2. EMA floor guard  
   Smoothed lower bound derived from `floorEma`.

The effective floor is the higher of those two values.

This means:

- the floor cannot instantly collapse from a single wave of sales
- the pool still gets more conservative as sell pressure accumulates

## Listing Price Model

Key constant:

- `STABILIZATION_SPREAD_BPS = 2000`

Listing reference from pool inventory:

- `listingPrice = floor * 1.2`

This is used when the protocol releases active pool inventory into the marketplace.

For vault inventory that came from buyback:

- `RELIST_PROFIT_BPS = 2000`
- target listing = `buybackPrice[tokenId] * 1.2`

That is important:

- relist target is tied to the actual buyback basis
- not just to a floating market number

## Market Inputs

The pool reads the following from the marketplace:

- `sales24h`
- `activeListings`
- `floorPrice`

These are converted inside the pool into:

- `purchaseRateBps = sales24h / liveSupply`
- `listingPressureBps = activeListings / liveSupply`
- `floorRatioBps = marketFloor / protocolFloor`
- `coverageRatioBps = ethBalance / targetExitBuffer`

Important constants:

- `EXPANSION_PURCHASE_RATE_BPS = 35`
- `EXPANSION_LISTING_PRESSURE_BPS = 800`
- `EXPANSION_FLOOR_RATIO_BPS = 12000`
- `WEAK_DEMAND_PURCHASE_RATE_BPS = 10`
- `WEAK_DEMAND_LISTING_PRESSURE_BPS = 1500`
- `WEAK_DEMAND_FLOOR_RATIO_BPS = 10000`

Interpretation:

- expansion means strong sales, manageable listing pressure, and marketplace floor above protocol floor
- weak demand means weak sales, heavy listings, and marketplace floor no longer outperforming the protocol floor

The pool still supports manual owner-set snapshots as a fallback, but the native marketplace is now the normal signal source.

## Market States

### Expansion

Typical meaning:

- recent market demand is healthy
- listing pressure is not too heavy
- market floor is comfortably above protocol floor

Protocol behavior:

- pool still protects reserve quality
- protocol inventory release is not the main goal
- the system avoids acting like unconditional bid support

### Stabilization

Typical meaning:

- the market is healthy enough to reintroduce inventory
- market floor is not weak
- listing pressure is manageable

Protocol behavior:

- `canReleaseInventoryForListing()` can become true
- pool inventory and vault inventory can move into the marketplace

### WeakDemand

Typical meaning:

- sales are weak
- listing pressure is elevated
- market floor does not clearly outperform protocol floor

Protocol behavior:

- pool gets more defensive
- buyback may become available if coverage is strong enough

## Sell-To-Pool Flow

User sell flow:

1. User owns NFT.
2. User calls router sell path or pool sell path directly.
3. Pool refreshes market state.
4. Pool checks:
   - launch protection is over
   - market state is not `Expansion`
   - reserve coverage is at least `100%`
5. Pool computes current sell price.
6. Pool takes the NFT and pays `price - fee`.
7. `totalSoldIntoPool` increases by `1`.

Trade fee:

- `TRADE_FEE_BPS = 250`

Fee split inside that `2.5%` fee:

- `10%` to stakers
- `25%` to pool reserve
- `25%` to treasury
- `40%` to protocol fees

Equivalent share of trade value:

- `0.25%` to stakers
- `0.625%` to pool reserve
- `0.625%` to treasury
- `1.0%` to protocol fees

## Native Marketplace Flow

### User listing

1. User transfers NFT into `PixelMarketplace`.
2. Marketplace creates a normal listing.
3. Another user buys it.
4. Marketplace takes market fee and sends proceeds to seller.

### Protocol listing

1. Pool or vault inventory is released into the marketplace.
2. The NFT is transferred with encoded listing metadata.
3. Marketplace automatically creates a protocol listing on receipt.
4. When purchased:
   - marketplace fee goes through `recordMarketplaceFee()`
   - proceeds go through `settleMarketplaceSale(...)`
   - pool pressure is reduced only after real sale settlement

This is what makes the system honest:

- moving a token into a listing contract does not count as recovery
- actual sale does

### Protocol listing cancel

If a protocol listing is cancelled:

- the NFT goes back to the pool or vault
- the pending sale flag is cleared
- sell pressure is not falsely reduced

## Buyback, Vault, And Burn

Buyback mode is available when one of these is true:

- inventory is stale
- inventory is excessive
- weak market conditions are active

And reserve coverage is at least `200%`.

Current buyback limits:

- treasury step: `10%`
- pool guardrail: `5%`
- maximum `8` NFTs per execution

The actual budget is the minimum of:

- `10%` of treasury
- `5%` of pool reserve

That is intentionally conservative.

Outcomes:

- some NFTs are burned
- some go into the vault

Vault inventory can later be:

- burned after age threshold
- reintroduced to the market when pricing conditions are good enough

Constants:

- `INVENTORY_STALE_AGE = 7 days`
- `VAULT_BURN_AGE = 14 days`

## Staking Layer

Staking is handled directly in `PixelPool`.

Users can:

- stake NFTs
- accrue fee share
- claim fees
- unstake with pending rewards auto-paid

Staking is denominated in actual protocol fee flow, not token emissions.

## Governance And Trust Notes

The current architecture still depends on owner / Safe controls for:

- pause / unpause
- listing venue configuration
- fallback market snapshot update
- fallback manual sale confirmation
- router replacement queue / apply / cancel
- protocol inventory release actions

This is documented in:

- [AUDIT.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/AUDIT.md)
- [EMERGENCY-GOVERNANCE.md](/Users/daniltkacev/Downloads/nft%20ponzo/docs/EMERGENCY-GOVERNANCE.md)

## Summary

OnChainPixel V1 is best understood as:

- fully on-chain art
- reserve-backed floor exits
- native marketplace trading
- treasury cleanup for weak markets
- staking funded by real usage

The protocol does not remove market risk.  
It tries to make NFT liquidity more structured, bounded, and transparent.
