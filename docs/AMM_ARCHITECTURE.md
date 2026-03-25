# OnChainPixel AMM Architecture

## Design Goal

The AMM is not meant to be a magical machine that makes every NFT liquid at a fair price forever.

Its job is narrower and more realistic:

- provide on-chain `floor liquidity`
- make reserve use predictable
- allow the market to decide rarity premiums outside the protocol

This architecture assumes:

- NFTs are unique
- floor liquidity is useful even when rarity pricing remains external
- reserve protection matters as much as price discovery

## System Components

### NFT Layer

`OnChainPixelNFT` is responsible for:

- storing pixel data on-chain
- rendering SVG on-chain
- minting to users directly or through router minter role
- protocol-authorized burn for treasury retirement

It does **not** decide market price.

### Pool Layer

`PixelPool` is responsible for:

- floor bid pricing
- pool inventory management
- fee accounting
- treasury buyback gating
- staking rewards

### Router Layer

`PixelRouter` is responsible for:

- collecting mint payment
- splitting proceeds
- seeding pool and treasury
- routing buy/sell UX through one entry point

### Factory Layer

`PixelFactory` is responsible for:

- deploying a collection stack
- wiring router permissions
- making the launch process repeatable

## Reserve Model

The architecture separates reserves by purpose.

### Pool Reserve

`ethBalance`

Used for:

- paying sellers when pool buying is enabled
- backing floor liquidity

Not used for:

- general treasury strategy
- narrative price support

### Treasury Reserve

`treasuryBalance`

Used for:

- selective buybacks in weak markets
- strategic inventory retirement

This separation is important because the protocol should not quietly treat treasury as if it were always part of liquid exit capacity.

## Price Model

## Bid Curve

The protocol uses a linear floor model instead of the older exponential framing.

Current conceptual form:

`bid(s) = max(minBid, initialBid - decay * s)`

Where:

- `s` = cumulative net NFTs sold into the pool
- `initialBid` = a fraction of mint price
- `minBid` = hard lower floor
- `decay` = how much bid falls as inventory accumulates

In the current contract:

- initial bid = `60%` of mint
- minimum bid = `15%` of mint
- full decay span = `3000` net sells

Here, `s` represents market-driven net sell pressure into the liquidity pool.
Internal protocol inventory moves such as vault relists do not count as new sell pressure and should not push the bid curve down on their own.

This makes the reserve liability easier to reason about than a narrative-heavy launch floor.

## Ask Curve

The pool does not keep inventory for sale in every market state.

When inventory selling is enabled:

`ask = bid + spread`

Current stabilization spread:

- `20%`

This spread is intentional. It compensates the pool for:

- inventory risk
- rarity uncertainty
- market-making service

## Why Not One Symmetric Price

A single quoted price is too fragile for NFT inventory.

Unlike fungible AMMs:

- inventory quality is uneven
- buyers often prefer selected NFTs
- sellers dump what they value least

So the protocol needs:

- a conservative bid
- a wider ask
- the ability to disable one side of the market when conditions worsen

## Market State Engine

The pool is state-aware.

It uses observed market signals to choose behaviour.

### Inputs

The pool tracks:

- short-window volume
- long-window volume
- short-window buys
- short-window sells
- smoothed floor baseline (`floorEma`)
- reserve coverage ratio

From these it derives:

- `volumeRatio`
- `pressureRatio`
- `floorDeviation`
- `coverageRatio`

## States

### 1. Expansion

Meaning:

- launch or growth phase
- activity is still forming
- the protocol should avoid becoming unconditional exit liquidity too early

Pool behaviour:

- selling into pool disabled
- inventory selling disabled
- no normal two-sided market yet

Why:

If the reserve is too available too early, sellers can dump into protocol support before the collection has discovered organic demand.

### 2. Stabilization

Meaning:

- volume is healthy enough
- floor is near its smoothed baseline
- buy and sell pressure are relatively balanced

Pool behaviour:

- selling into pool enabled
- inventory selling enabled
- ask uses `20%` spread

Why:

This is the only state where the protocol should behave as a normal NFT AMM.

### 3. WeakDemand

Meaning:

- short-term activity weakens
- sell pressure dominates
- floor trades below baseline

Pool behaviour:

- inventory selling disabled
- reserve protection prioritized
- treasury buyback may be enabled if coverage is healthy

Why:

When demand weakens, the protocol should not add more supply to the market.

## Market Signals In Practice

### Volume Ratio

Compares short-term activity to longer-term baseline.

Used to detect:

- whether the market is cooling down
- whether the current state is still active enough for two-sided trading

### Pressure Ratio

Compares short-window sells to buys.

Used to detect:

- whether sellers are dominating
- whether the pool should move into a defensive state

### Floor Deviation

Compares current floor to smoothed floor.

Used to detect:

- whether the current floor is being pushed below normal regime

### Coverage Ratio

Measures reserve health relative to a target exit buffer.

Used to detect:

- whether the reserve can support buying
- whether treasury buyback should be allowed

## Sell Flow

When `canSellIntoPool()` is true:

1. user transfers NFT into pool
2. pool computes current bid
3. fee is applied
4. seller receives payout from pool reserve
5. pool inventory increases
6. market windows and floor baseline update

This is instant floor exit, not rarity pricing.

## External Listing Release Flow

When `canReleaseInventoryForListing()` is true:

1. protocol inventory can be released from pool or vault to the listing vault
2. release uses the pool ask as a reference price, not as an internal sale
3. the protocol can list inventory outward instead of acting as its own storefront
4. sell pressure can be reduced when pool inventory is released
5. rarity and premium discovery happen on the external market

This keeps the pool as a floor-exit venue and leaves resale to the listing layer.

## Inventory Philosophy

The pool inventory is not assumed to be "average quality".

The protocol intentionally accepts this:

- weaker NFTs will often flow into the pool
- better NFTs may occasionally be mispriced into the pool
- community reprices premiums outside the protocol

This is acceptable because the pool is a floor venue, not a rarity exchange.

## Buyback Philosophy

Buyback is not always-on support.

It is a treasury operation triggered only when:

- state is `WeakDemand`
- short-term volume is weak
- sell pressure is high
- floor is below smoothed baseline
- coverage ratio remains strong enough

This means treasury acts only when the market is:

- oversold
- weak
- still safely coverable

That makes buyback a strategic stabilizer, not a blind subsidy.

## Burn Path

Treasury retirement now uses a real protocol burn path through the NFT contract.

This means:

- the ERC-721 token is actually burned
- NFT-layer `totalSupply()` can decrease
- supply contraction is real, not just symbolic parking at a dead address

## Relist Semantics

Relist is an inventory operation, not a new market sell event.

That means:

- relist can move vault inventory into the external listing lane
- relist must not increase the variable that tracks cumulative sell pressure

Otherwise the protocol would artificially degrade its own floor curve by moving NFTs between internal buckets.

## Staking Layer

Staking gives NFT holders access to fee flow.

It does not change the pricing model directly.

Its role is:

- align long-term holders with pool activity
- distribute some trading revenue to committed participants

This keeps the protocol closer to market infrastructure than to reflexive tokenomics.

## Why This Architecture Is Better Than The Old One

The previous architecture leaned too hard on:

- unconditional exit framing
- early floor optimism
- overly aggressive support narratives

The new architecture is stronger because it:

- separates reserve roles
- uses simpler bid math
- limits protocol market-making to the floor exit lane
- lets community, not protocol, discover rarity premiums
- avoids pretending the pool can be fair to every NFT at every moment

## Current Contract Mapping

The current code expresses this architecture through:

- `getFloorPrice()` for linear bid
- `getListingPrice()` for external listing reference
- `canSellIntoPool()` for reserve-backed floor buying
- `canReleaseInventoryForListing()` for state-gated listing release
- `getMarketSignals()` for state transitions
- `executeBuyback()` for treasury-driven weak-market support
- `protocolBurn()` for real NFT supply contraction

## Open Follow-Up Work

1. Build tests around each market state transition.
2. Simulate reserve exhaustion and coverage thresholds.
3. Decide whether launch protection duration should be configurable.
4. Add better UI surfacing for pool state and disabled actions.
5. Reconcile public docs and frontend copy with this architecture.
