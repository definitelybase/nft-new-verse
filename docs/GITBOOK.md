# OnChainPixel

## What This Project Is

OnChainPixel is a fully on-chain pixel NFT protocol with two native market layers:

- an on-chain floor exit lane through `PixelPool`
- an on-chain peer-to-peer and protocol marketplace through `PixelMarketplace`

The protocol is designed around a simple idea:

- art lives fully on-chain
- the protocol can quote a reserve-aware floor
- the marketplace can handle premium discovery above that floor

This is not meant to be "an NFT that the protocol always buys back at a fair price".  
It is meant to be a more honest NFT system:

- the protocol handles floor liquidity when reserve conditions allow it
- the market handles rarity, premium, taste, and speculation

## Core Promise

OnChainPixel tries to solve a specific problem:

**most NFTs have no native exit lane at all.**

What we offer instead:

- a mint that seeds liquidity from day one
- a floor bid curve that is reserve-aware
- a native market where both users and protocol inventory can trade
- treasury buyback and burn logic for weak markets
- staking that earns from trade activity

## What The Protocol Does Not Promise

The protocol does **not** promise:

- guaranteed profit after mint
- permanent buy support at any price
- fair rarity pricing for every NFT
- infinite liquidity
- zero governance risk

The pool is a floor market.  
It is not a rarity oracle.

## How Mint Works

The mint path is intentionally simple:

1. A minter prepares a packed pixel payload.
2. The user calls `PixelRouter.mint(...)`.
3. The router mints the NFT directly to the user.
4. The mint payment is split into:
   - pool reserve
   - treasury reserve
   - creator / team wallet
5. The pool updates total minted supply.

Baseline economic intent:

- `60%` to pool reserve
- `10%` to treasury reserve
- `30%` to protocol operations

Why this matters:

- the collection is not born empty
- reserve depth exists from the first successful mint
- treasury exists as a separate balance, not hidden inside the main pool reserve

## What Happens After Mint

After mint, the system has three possible trading paths.

### 1. Peer-to-peer listing

A user can list an NFT on the native marketplace and sell it directly to another user.

This is where premium pricing should happen.

### 2. Sell into pool

A holder can sell into the pool when pool buying is enabled.

This is the floor exit lane.

The pool:

- checks market state
- checks reserve coverage
- calculates the current floor bid
- pays out floor minus fee
- takes the NFT into protocol inventory

### 3. Protocol inventory resale

The protocol can later release inventory into the native marketplace.

That inventory is not "magically healthy" just because it moved into a listing.  
The system only reduces sell pressure after the NFT is actually sold in the marketplace.

This is important because it prevents fake recovery signals.

## Native Marketplace

The marketplace is part of the protocol, not an afterthought.

It supports:

- normal user listings
- protocol listings from the pool
- a rolling 24-hour sales count
- an active listing count
- a current market floor

Those values are fed back into the pool as market signals.

That means the protocol does not need OpenSea or another external venue to understand its own market.  
V1 is designed around the idea that trading happens in the native marketplace.

## Floor Model

The floor is not constant.

It starts from mint economics and becomes more conservative as more NFTs are sold into the pool.

Current baseline:

- initial floor bid = `60%` of mint price
- minimum floor bid = `15%` of mint price
- bid decay reaches the minimum after roughly `3000` net pool sells

There is also an EMA floor guard so the floor does not snap to zero or collapse too abruptly.

This model exists to keep reserve obligations bounded and understandable.

## Market States

The pool runs in three states:

### Expansion

This is early growth or strong demand.

Typical meaning:

- purchase rate is healthy
- listing pressure is not too heavy
- marketplace floor is above protocol floor

In this state the protocol is conservative about becoming a floor dump venue.

### Stabilization

This is the normal operating state.

Typical meaning:

- the market is active but not euphoric
- inventory can be released to the marketplace
- protocol inventory can re-enter the market in a controlled way

This is the state where the protocol behaves most like a healthy two-sided system.

### WeakDemand

This is the defensive state.

Typical meaning:

- purchase rate weakens
- listing pressure rises
- market floor no longer clearly outperforms protocol floor

In this state the protocol becomes more cautious and treasury actions may become relevant.

## Buyback, Vault, And Burn

Buyback is not a permanent promise of support.

It is a targeted treasury action used when:

- inventory is stale
- inventory is too large
- or market conditions are weak enough to justify intervention

Buyback can:

- move NFTs out of active pool inventory
- send some inventory into a vault
- burn part of inventory over time

The goal is not to fake strength.  
The goal is to stop the system from becoming a warehouse of stuck inventory.

## Staking

Staking is tied to actual protocol usage.

Holders can stake NFTs into the pool and earn a share of trade fees.

That means staking rewards come from market activity, not from inflation or a separate emissions token.

This keeps the system cleaner:

- no extra reward token
- no fake APY detached from usage
- staking aligned with protocol volume

## Why This Project Is Different

Most NFT systems split these concerns apart:

- art is one system
- marketplace is another
- liquidity is somewhere else
- treasury logic barely exists

OnChainPixel tries to keep those layers in one coherent design:

- on-chain art
- reserve-backed floor logic
- native marketplace
- treasury cleanup path
- staking based on real volume

That does not make it risk-free.  
It does make the design easier to reason about than vague "floor support" promises.

## Where To Read Next

If you want more detail:

- [README.md](../README.md) for repo layout and commands
- [AMM_ARCHITECTURE.md](./AMM_ARCHITECTURE.md) for exact mechanics and formulas
- [AUDIT.md](./AUDIT.md) for transparent trust and risk
- [EMERGENCY-GOVERNANCE.md](./EMERGENCY-GOVERNANCE.md) for owner powers and Safe operations
