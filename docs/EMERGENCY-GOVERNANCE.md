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

In [contracts/PixelPool.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelPool.sol), the owner can:

- queue and apply router changes
- cancel a pending router change
- set the listing venue
- update fallback market snapshots
- confirm fallback external sales
- release protocol inventory for listing
- relist vault inventory
- pause
- unpause
- claim protocol fees

The owner does **not** have a general "drain the whole pool reserve" function.

### PixelRouter owner powers

In [contracts/PixelRouter.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelRouter.sol), the owner can:

- change mint price
- change creator address
- change pool seed bps
- change treasury bps
- rescue stuck ETH or NFTs from the router

### OnChainPixelNFT owner powers

In [contracts/OnChainPixelNFT.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/OnChainPixelNFT.sol), the owner can:

- set minter
- set burner
- set palette until locked
- lock palette
- set mint price
- enable or disable public mint
- withdraw ETH held by the NFT contract

### PixelMarketplace owner powers

In [contracts/PixelMarketplace.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/PixelMarketplace.sol), the owner can:

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
3. Publish a short technical incident note.

### After containment

1. Decide whether recovery is possible inside current contracts.
2. If not, document migration or redeploy plan honestly.
3. Do not reopen until:
   - root cause is identified
   - Safe signers agree
   - public note is ready

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
- market fallback updates
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
