# Emergency Governance

This document explains who can currently do what, what should sit in a Safe, and how the team should react if something goes wrong.

## Governance Model

Current recommended governance model:

- owner = Safe
- deployer = temporary EOA only for deployment execution
- protocol should not stay owned by a personal wallet after live deployment

Recommended Safe policy:

- `2 of 3` for a small team
- or `3 of 5` for a broader team

Recommended signer mix:

- founder / product owner
- technical signer
- separate trusted signer who is not the same operational laptop

## What The Owner Can Do

### PixelPool owner powers

In [contracts/PixelPool.sol](../contracts/PixelPool.sol), the owner can:

- queue and apply router changes
- cancel a pending router change
- set the listing venue
- enable manual snapshot mode while the pool is paused
- disable manual snapshot mode
- update a manual market snapshot while the pool is paused and manual mode is active
- release protocol inventory for listing
- relist vault inventory
- pause
- unpause
- claim protocol fees

The owner does **not** have a general "drain the whole pool reserve" function.

### PixelRouter owner powers

In [contracts/PixelRouter.sol](../contracts/PixelRouter.sol), the owner can:

- change mint price
- change creator address
- change pool seed bps
- change treasury bps
- rescue stuck ETH or NFTs from the router

### OnChainPixelNFT owner powers

In [contracts/OnChainPixelNFT.sol](../contracts/OnChainPixelNFT.sol), the owner can:

- set minter
- set burner
- set palette until locked
- lock palette
- set mint price
- disable public mint
- withdraw stray ETH held by the NFT contract

Important:

- the direct public mint path is intentionally disabled
- normal minting is expected to go through the router so reserve / treasury routing still happens

### PixelMarketplace owner powers

In [contracts/PixelMarketplace.sol](../contracts/PixelMarketplace.sol), the owner can:

- pause
- unpause
- cancel protocol-owned listings
- update protocol listing prices

It does not manage user custody outside those protocol-owned paths.

## What Is Instant And What Is Delayed

### Instant actions

These should remain fast:

- `pause`
- `unpause`
- emergency public communication
- frontend kill-switches or warning banners

These are the actions that matter first during a real incident.

### Delayed actions

Router replacement should not remain an instant power forever.

Current pool behavior:

- during launch setup, router replacement can still be immediate
- after that, router replacement is queued
- a `48 hour` delay applies before activation

This is meant to protect users from a surprise router swap.

## Emergency Manual Snapshot Mode

This mode exists for incident handling only.

It is not a normal market-operations tool and it is not meant for "tuning" the protocol during live trading.

Current guardrails:

- the pool must already be paused
- the listing venue must already be paused
- the owner must explicitly enable manual mode
- manual mode can only be enabled for up to `1 hour`
- each manual snapshot only remains live for `30 minutes`

What this means in practice:

- the protocol cannot quietly mix manual pricing into live trading
- the team must first stop the venue, then enter a short recovery window
- once the window expires, live venue signals take over again

### What manual mode is for

Use it only if:

- the marketplace signal feed is broken
- the marketplace is paused for incident recovery
- the team needs a short snapshot so state transitions do not go blind during containment

### What manual mode is not for

Do not use it to:

- make sell-to-pool look healthier
- accelerate buyback or release decisions during normal trading
- override a real live market just because the numbers are inconvenient
- operate the protocol day to day

### Exact emergency sequence

1. Pause the pool.
2. Pause the marketplace.
3. Announce that the protocol is in incident mode.
4. Enable manual snapshot mode for the shortest useful window, never more than `3600` seconds.
5. Publish or record the exact reason the team is using manual mode.
6. Submit the temporary snapshot.
7. Repair the incident or finish the maintenance task.
8. Disable manual snapshot mode.
9. Unpause the marketplace.
10. Unpause the pool.

### Keeper commands

These commands prepare Safe payloads; they do not remove the need for Safe review.

Enable manual mode:

```bash
RPC_URL=https://... npm run keeper:market -- manual-on deployment-11155111.json 1800
```

Set the temporary snapshot:

```bash
RPC_URL=https://... npm run keeper:market -- snapshot deployment-11155111.json 35 800 0.012
```

Disable manual mode after recovery:

```bash
RPC_URL=https://... npm run keeper:market -- manual-off deployment-11155111.json
```

## What We Should Not Do Yet

### No renounce right now

The contracts should not be renounced at this stage.

Why:

- the system still needs operational flexibility
- a live bug may require pause or configuration action
- palette lock must happen deliberately
- governance hardening is not finished just because ownership changed to a Safe

### No fake "locked liquidity" story

The protocol is not a Uniswap LP token system.

That means "lock LP for one year" is not the right mental model here.

The more honest story is:

- main reserve is not directly owner-withdrawable
- ownership should sit in a Safe
- dangerous admin changes should be delayed or limited

## Incident Playbook

### First 15 minutes

1. Pause the pool if user funds may be at risk.
2. Stop frontend actions that could route more users into danger.
3. Announce that the protocol is paused and being investigated.

### First hour

1. Confirm which contract and function are affected.
2. Confirm whether:
   - reserve is at risk
   - inventory accounting is wrong
   - marketplace settlement is affected
   - mint should be disabled at the UI layer
   - manual snapshot mode is actually needed, or whether the market feed is still trustworthy
3. Publish a short technical incident note.
4. If manual snapshot mode is used, write down:
   - who proposed it
   - why it was needed
   - what values were entered
   - when it will be turned off

### After containment

1. Decide whether recovery is possible inside current contracts.
2. If not, document migration or redeploy plan honestly.
3. Do not reopen until:
   - root cause is identified
   - Safe signers agree
   - public note is ready
4. Turn off manual snapshot mode before reopening if it was enabled.

## Normal Operating Playbook

### Before live deployment

1. Set palette.
2. Lock palette.
3. Wire router / marketplace / listing venue.
4. Transfer ownership to Safe.
5. Verify ownership and deployment file.

### During normal operations

Use the Safe for:

- config changes
- emergency manual snapshot mode only when both pool and marketplace are paused
- protocol listing decisions
- fee claims
- incident actions

Keep a written internal checklist for:

- signer roles
- transaction review
- deployment verification
- frontend address updates

## Recommended Long-Term Direction

Short term:

- Safe ownership
- delayed router changes
- clear operator playbook

Mid term:

- reduce fallback paths that require manual owner actions
- automate more market plumbing through the native marketplace

Long term:

- decide what powers should be frozen permanently
- decide whether some owner powers should move behind stronger governance

## Bottom Line

The strongest realistic governance position today is:

- Safe ownership
- palette locked
- router changes delayed
- instant pause retained
- no renounce yet

That is safer and more honest than pretending the protocol is already immutable when it is not.
