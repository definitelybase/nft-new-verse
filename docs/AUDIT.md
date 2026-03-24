# OnChainPixel — Current Audit Notes

This file is no longer a historical list of problems from the old architecture.  
It is the current `open issues` register for the repo after the NFT / Pool / Router / Factory alignment work.

## Closed Since The Original Draft

These issues were present in the earlier version and are now addressed in the codebase structure:

- Router ↔ NFT mint flow now uses `mintTo` / `mintToCustom`
- `seedLiquidity`, `seedTreasury`, and `setTotalMinted` are router-gated
- `buySpecific()` exists in the pool and router flow
- Factory exists and now passes corrected constructor arguments
- Pool uses `Pausable`
- Contracts and docs have been reorganized into a clearer project layout
- direct public mint bypass of router economics is now closed by default
- router mint now requires exact payment instead of silently absorbing overpayment
- treasury burn path now uses real NFT-layer protocol burn instead of transfer to `0xdead`
- relist no longer mutates the sell-pressure variable used by the floor curve
- minimal Hardhat build pipeline now exists and exports `build/*.abi` and `build/*.bin`
- first Hardhat smoke suite now covers wiring, router mint split, exact payment, and basic sell/buySpecific flow
- `PixelFactory` now has local end-to-end coverage for collection creation and stack wiring

Those were real blockers in the old version, but they are no longer the most important unresolved risks.

## Current Critical Risks

### 1. Build exists, but validation depth is still low

The repo now has a working minimal Hardhat build flow and a first smoke suite, but validation depth is still low.

Practical impact:

- contracts now compile and export deployment artifacts
- a first smoke suite now proves basic deployment and core router/pool flows
- but edge cases, treasury loops, and scenario math are still not deeply validated
- the project now pins a supported Node line via `.nvmrc` and `package.json`, and that environment should be used consistently

Why it matters:

The biggest remaining risk is no longer "can the repo compile at all", but "can the compiled system be trusted beyond smoke scenarios".

Required next step:

- keep the supported Node runtime consistent across machines
- keep the build green
- add real tests before making more architectural promises

### 2. Router sell flow remains operationally fragile

Current router sell flow:

1. transfers NFT from user to router
2. router approves the specific token to the pool
3. router calls `pool.sell()`

Open concern:

- the pattern is heavier than necessary
- custody still briefly passes through the router
- the sell flow is not yet proven under test

Safer target:

- either keep this as the canonical convenience flow and test it thoroughly
- or simplify further with a more direct sell path

### 3. Market-state math is untested

`PixelPool` now contains the most important protocol logic:

- rolling short/long windows
- floor EMA updates
- state transitions
- conditional pool buy/sell activation
- treasury buyback gating

All of that is currently logic-first, not test-first.

This creates risk of:

- incorrect state transitions
- thresholds behaving unexpectedly
- buy/sell paths being unavailable more often than intended
- buyback mode activating or never activating incorrectly

This is the highest smart-contract logic risk after the missing build system.

## Important Risks

### 4. Supply accounting is improved, but not yet validated end-to-end

The protocol now uses a real NFT-layer burn path and the pool is wired as an authorized burner.

Open concerns:

- no compile proof yet that the new burner role and protocol burn path integrate cleanly with the chosen OpenZeppelin version
- no runtime proof yet that burn updates supply-facing views exactly as intended across buyback and vault burn flows
- no proof yet that indexers and UI assumptions remain correct once tokens are actually burned

Impact:

- the architecture is materially better
- but the new burn path still needs system-level validation before it can be treated as production-safe

### 5. Factory deployment model is still assumption-heavy

`PixelFactory` stores creation bytecode blobs and deploys contracts with `CREATE2`.

Open concerns:

- local tests now prove constructor encoding, ownership handoff, and router/burner wiring on a generated collection stack
- but there is still no proof yet that the same flow behaves correctly in a real external deployment environment
- bytecode upload and large-transaction behaviour on target networks are still unvalidated

Impact:

- factory is no longer a blind spot locally, but it is still not fully deployment-proven

### 6. Buyback / vault / relist loop is logically plausible but not verified

The current pool keeps:

- treasury buyback
- real protocol burn
- vault inventory
- relist conditions

Open concerns:

- relist loop is not tested under repeated inventory conditions
- vault may become sticky if pricing conditions rarely line up
- strategic behaviour of relist under weak market conditions is still uncertain
- burn and relist now have cleaner semantics, but that logic is still unproven under scenario tests

This is not an immediate blocker for architecture, but it is a serious behavioural risk.

### 7. Frontend is still mock-driven

The frontend files are useful prototypes, but they do not yet represent the current live contract logic.

Impact:

- the UI can easily teach the wrong economics
- market states, disabled actions, and spread logic are not yet surfaced from live data

This matters especially because the protocol now depends on dynamic availability:

- pool buying is not always enabled
- pool selling is not always enabled
- buyback is conditional

The UI must communicate that clearly.

## Medium-Priority Gaps

### 8. No event stream for price / state indexing beyond current basics

The pool emits trade events and state changes, but the indexing story is still incomplete for analytics UX.

Potential additions:

- explicit floor-price update event
- buyback-availability event
- reserve health snapshots

Not required for correctness, but very useful for frontend and monitoring.

### 9. No explicit emergency reserve escape hatch design

This remains intentionally unimplemented, but it is still a governance and protocol design question.

Possible options:

- no rescue at all
- timelocked emergency withdrawal
- multisig or DAO-controlled emergency path

The key is to decide deliberately, not by omission.

### 10. Rarity premium remains out of scope for protocol pricing

This is no longer treated as a bug by default.

Still, it is a product decision that should remain explicit:

- protocol prices floor assets
- community prices premium assets

That boundary is healthy, but it should be documented consistently.

## Recommended Immediate Priorities

### Do Now

1. Move local development to a supported Node version and keep the Hardhat build green.
2. Write Pool/Router-first tests for the new market-state model.
3. Validate the new protocol burn flow and relist math under scenario tests.

### Do Before Any Public Testnet Push

4. Validate Factory deployment flow end-to-end.
5. Test router sell and buy flows with real approvals.
6. Add coverage for buyback, vault, and relist behaviour.

### Do Before Mainnet

7. Connect frontend to real pool state signals.
8. Add better indexing / analytics events if needed.
9. Decide emergency governance posture explicitly.

## Current Audit Summary

The project is in a better architectural state than the original version:

- the protocol narrative is cleaner
- the contract roles are more aligned
- the reserve model is more honest
- supply contraction is now modeled as real burn, not symbolic parking

But the repo is still in `pre-validation` stage, not `pre-deployment` stage.

The biggest risk is no longer "the idea is inconsistent."  
The biggest risk is "the new architecture now compiles, but has not yet been tested and exercised as a full system."
