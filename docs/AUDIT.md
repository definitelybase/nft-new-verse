# OnChainPixel Audit Notes

This document is not an external audit.  
It is the current transparent status of what is hardened, what still depends on trust, and what remains before a serious public launch.

## Scope

Current stack covered by internal tests and review:

- [contracts/OnChainPixelNFT.sol](../contracts/OnChainPixelNFT.sol)
- [contracts/PixelPool.sol](../contracts/PixelPool.sol)
- [contracts/PixelRouter.sol](../contracts/PixelRouter.sol)
- [contracts/PixelMarketplace.sol](../contracts/PixelMarketplace.sol)
- [contracts/PixelFactory.sol](../contracts/PixelFactory.sol)

## What Has Been Hardened

### Ownership handoff

The repo now supports:

- deploy to an EOA
- automatic palette lock
- ownership transfer to a Safe
- post-deploy ownership verification

Relevant scripts:

- [scripts/deploy-local.js](../scripts/deploy-local.js)
- [scripts/deploy.js](../scripts/deploy.js)
- [scripts/transfer-ownership.js](../scripts/transfer-ownership.js)
- [scripts/verify-deployment.js](../scripts/verify-deployment.js)

### Palette mutability

The NFT palette can now be locked before ownership handoff.  
This removes the worst version of the "art can change after sale" risk.

### Router replacement hardening

Router replacement is no longer an instant forever-power after setup.

Current behavior:

- during launch protection / setup it can still be changed immediately
- after that it must be queued
- a `48 hour` delay applies before activation

This does not remove governance risk, but it reduces instant malicious replacement risk.

### Native marketplace settlement

Protocol listings now settle through the native marketplace.

That means:

- protocol inventory can be sold in the marketplace
- settlement back to the pool or treasury is automatic
- sell pressure only improves after a real sale

This is cleaner and safer than manual "pretend the listing sold" logic.

### Market state inputs

The pool can now read live market signals from the native marketplace:

- recent sales
- active listings
- market floor

Manual snapshot updates still exist as fallback, but they are no longer the primary path in the intended V1 architecture.

### Staking and fee accounting

Staking, fee accumulation, claim, and unstake paths are covered by tests and currently behave as intended under the present suite.

### Admin and deploy guards

The repository now includes guards and tests around:

- zero-address dependencies
- invalid constructor configuration
- access control
- ownership handoff
- factory deployment prerequisites

## Current Test Status

At the time of this document refresh:

- Hardhat suite passes with `72` tests
- frontend production build passes

The test suite covers:

- mint flow
- sell-to-pool flow
- marketplace flow
- protocol listing settlement
- staking
- market state transitions
- buyback / vault / burn flows
- ownership handoff
- deploy and factory guards

## Transparent Trust Assumptions

These are the current trust assumptions that still exist.

### 1. Owner / Safe still matters

The protocol is not ownerless.

Owner powers still include important actions such as:

- pausing the pool
- setting listing venue
- queueing or applying router changes
- releasing protocol inventory
- updating fallback market snapshots
- claiming protocol fees

This means governance hardening matters just as much as contract correctness.

### 2. No external audit yet

This is still an internally tested codebase.

That means:

- internal confidence has improved
- external mainnet confidence is still incomplete

No serious public launch should be described as fully de-risked without an independent review.

### 3. No emergency reserve drain

There is no general owner drain of the main pool reserve.

This is intentional, but it creates a tradeoff:

- less rug-style reserve extraction risk
- less flexibility if a critical bug is found after deployment

### 4. Native marketplace is new protocol surface

The move to a native marketplace improves coherence, but it also adds a new contract and a new attack surface:

- listing creation
- cancellation
- purchase flow
- fee routing
- protocol listing settlement

The new marketplace is tested, but it is still new code that deserves external review before mainnet.

## Main Remaining Risks

### 1. Governance centralization

If ownership sits on a weak wallet or a badly managed Safe, the protocol can still be misconfigured or harmed.

Current recommended answer:

- Safe ownership
- documented signers
- disciplined ops

### 2. Factory gas on L1

The factory path remains a convenience / test path, not yet a proven Ethereum mainnet deployment path.

Direct deploy is the more practical route for testnet and early rollout.

### 3. Economic tuning is not final

The math is coherent enough for testing, but some values are still product decisions, not eternal truths.

Examples:

- exit buffer size
- buyback step sizes
- inventory band thresholds
- market-state thresholds

These values still need live validation.

### 4. Operational dependence for some fallback paths

Normal protocol listings settle automatically now, which is good.

But the system still keeps fallback controls for:

- manual market snapshot updates
- manual sale confirmations in non-standard cases

Those fallbacks are operationally useful, but they still imply owner power.

## What Is Good Enough Right Now

Reasonable for:

- local development
- private demos
- Sepolia testing
- UX iteration
- protocol simulations

Not enough for:

- serious public mainnet launch
- "trustless" marketing language
- aggressive economic claims

## What Should Happen Before Public Testnet

1. Deploy with Safe ownership, not a personal wallet.
2. Document the signer set and approval policy.
3. Re-run the new marketplace flow end-to-end on Sepolia.
4. Make sure the frontend is wired to the native marketplace, not old assumptions.

## What Should Happen Before Mainnet

1. Independent audit.
2. Final governance policy:
   - what can be paused
   - what can be changed
   - what should eventually be frozen
3. Economic review of current thresholds with real market simulations.
4. Clear public docs that match the contracts exactly.

## Bottom Line

OnChainPixel is now much cleaner than the earlier versions:

- ownership handoff is safer
- palette mutability is controlled
- router changes are delayed
- native marketplace settlement is automatic
- market state inputs are more aligned with the actual venue

But this is still a protocol under active hardening, not a finished mainnet product.
