# OnChainPixel — Current Audit Notes

This file is the current `open issues` register for the repo after the NFT / Pool / Router / Factory alignment work, the contract hardening round, and the deploy-safety pass.

## Closed Since The Original Draft

These issues were present in earlier versions and are now addressed:

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
- Router rescue functions (rescueNFT, rescueETH) added and tested

## Closed During Contract Hardening Round

### Staking double-claim bug — FIXED

`_settle()` did not update `rewardDebt` after accumulating pending rewards. This allowed stakers to claim the same fees repeatedly: `claimFees()` zeroed `pendingRewards`, but `rewardDebt` stayed stale, so the next call to `viewPendingFees()` recalculated the same amount.

Fix: `_settle()` now sets `rewardDebt[u] = stakedCount[u] * accFeePerStake` after accumulation.

Covered by 9 staking tests including fee distribution, double-claim prevention, and edge cases.

### Router sell flow — VALIDATED

Previously listed as "operationally fragile" and untested. Now covered by 7 sell edge case tests:

- sell during launch protection → `PoolSellDisabled`
- sell with insufficient pool ETH → reverts
- slippage protection (minPrice > floor) → `SlippageExceeded`
- payout accuracy verified to the wei
- no ETH or NFT left stuck in router after sell
- non-owner sell rejection
- sequential sells decrease pool ethBalance correctly

### Market-state math — VALIDATED

Previously listed as the highest smart-contract logic risk. Now covered by 8 stress tests:

- Expansion enforced during launch protection
- Expansion → WeakDemand transition after first sell
- Recovery from WeakDemand → Stabilization with balanced volume
- ethBalance never goes negative through sell cycles
- Floor price stays above MIN_BID after many sells
- Supply accounting (circulating + locked + pool = minted - burned) is consistent
- State transitions are idempotent across repeated window rolls
- Large mint+sell wave keeps pool solvent

### Supply accounting — VALIDATED

Previously concern about burn path integration. Now verified:

- `totalMinted` reads from pool directly (not derived from circulating+locked+pool)
- circulating + locked + pool = minted - burned verified under mixed operations
- lockedSupply matches totalStaked
- Protocol burn reduces NFT total supply across immediate and aged vault burns

### Buyback / vault / relist loop — VALIDATED

Previously listed as "logically plausible but not verified". Now covered:

- buyback vaults stale inventory and recapitalizes pool reserve
- burnAgedVaultInventory works correctly even with mixed-age vault items
- relist releases vault inventory to the external listing vault without increasing sell pressure
- buyback disabled at exact weak-market boundary values
- buyback enabled once weak-market signals move past thresholds
- buyback disabled below coverage threshold even for stale inventory
- treasury budget exhaustion stops buyback correctly

### Frontend — FUNCTIONAL

Previously listed as "readable but not transactional". Now:

- Live pool state reads via usePoolData hook (15s polling)
- Real buy/sell marketplace flows with wallet integration
- Proper error/loading/preview states (DataBadge: Live/Preview/Offline)
- Simplified Mint page (single functional card, no decorative modes)
- Slippage protection in buy/sell UI

### Protocol-fee and admin-path invariants — VALIDATED

Previously listed as untested. Now covered:

- `claimProtocolFees()` is owner-only, drains the exact accrued amount, and reverts when empty
- `pause()/unpause()` blocks and restores trade-paths as expected
- `factoryFee` enforcement and `withdraw()` are covered end-to-end
- factory admin setters are owner-only
- NFT admin setters (`setMinter`, `setBurner`, `setPalette`, `lockPalette`, `setMintPrice`, `setPublicMintEnabled`) are owner-only
- NFT owner-withdraw path for mint proceeds is covered
- palette updates work before `lockPalette()` and revert after lock

### Admin / emergency event stream — IMPROVED

Router and pool admin/emergency paths now emit explicit events for:

- creator updates
- mint-price / BPS changes
- router updates
- rescueNFT / rescueETH
- factory code updates and fee updates

This is enough for basic indexing and ops visibility, though analytics-oriented events are still limited.

### Deploy/config guards — IMPROVED

Constructor and config validation is tighter now:

- `OnChainPixelNFT` rejects `mintPrice == 0`
- `PixelPool` rejects zero-address NFT, non-contract NFT dependency, and `mintPrice == 0`
- `PixelRouter` rejects zero-address dependencies, non-contract NFT/pool dependencies, and `mintPrice == 0`
- `PixelFactory.createCollection()` rejects `mintPrice == 0`
- `setTotalMinted()` is monotonic and cannot move backwards

This reduces the chance of bad local/testnet deployments silently producing broken state.

### Ownership handoff and palette finalization — IMPROVED

The deployment scripts now support a safer live rollout path:

- `OWNER_ADDRESS` / `SAFE_ADDRESS` can receive final ownership of NFT, Pool, Router, and Factory
- `CREATOR_ADDRESS` can be separated from deployer
- palette lock is applied by default before ownership handoff
- deployment JSON now records final owner and palette-lock status

This does not replace a timelock or audit, but it removes the "single hot wallet owns everything forever" default from the deploy path.

### Router replacement hardening — IMPROVED

`PixelPool.setRouter()` is no longer a fully instant owner power once the protocol is live:

- initial router setup still works immediately
- router changes remain immediate during the launch-protection/bootstrap window
- after launch protection, owner must first queue a new router and only later apply it
- pending router updates can be cancelled before execution

This preserves practical setup flexibility while making post-launch router swaps visible and non-instant.

### External market state and listing confirmation — IMPROVED

The pool no longer relies on stale internal buy/sell window math after the protocol moved resale outward:

- `getMarketSignals()` now derives state from `externalSales24h`, `externalListings`, and `externalFloor`
- release to the external listing vault no longer reduces `totalSoldIntoPool` on its own
- `confirmExternalSale()` is now the explicit point where external resale can reduce stored sell pressure
- vault relist now uses the stored `buybackPrice * 1.2` target directly

This aligns the contract with the newer architecture where the pool is a floor-exit venue and resale happens externally.

## Current Test Coverage

**70 passing tests** across 13 test files:

| Suite | Tests | Coverage |
|-------|-------|----------|
| Admin / emergency events | 3 | Router/pool admin events, factory setup/admin events, mint-side accounting events |
| Protocol/admin invariants | 3 | claimProtocolFees, pause/unpause, factory fee/withdraw |
| Deploy/config guards | 4 | zero-price rejects, dependency validation, factory create guards |
| PixelFactory creation guards | 4 | empty bytecode rejects, missing bytecode, invalid BPS, DeployFailed path |
| Factory / NFT admin paths | 4 | onlyOwner setters, withdraw paths, palette lock, multisig handoff |
| Smoke (router/pool wiring) | 11 | Deployment, mint splits, exact payment, rescue, constructor/config guards, sell/list/release flow, refunds |
| Economics | 4 | Buyback, protocol burn, vault burn, relist |
| Scenarios | 4 | Sell pressure tracking, external-sale confirmation, budget exhaustion, WeakDemand gates |
| Market-state thresholds | 6 | Launch protection, coverage gates, listing activation, buyback gating |
| Staking | 9 | Stake/unstake, access control, fee distribution, claim, edge cases |
| Router sell edges | 7 | All sell revert conditions, payout accuracy, no stuck assets |
| Market stress | 9 | State transitions, solvency, floor stability, supply consistency, heavy sell-lane closure |
| Factory e2e | 2 | Stack creation, sell/buySpecific flow |

## Remaining Risks

### 1. Factory deployment gas cost

`PixelFactory.createCollection()` is still gas-heavy. Local Hardhat tests now pass with an explicit fixed gas configuration, but this does not prove the path is comfortable on L1 mainnet. Options:

- Optimize factory contract size
- Deploy on L2 where gas limits are higher
- Validate real deployment gas on testnet before any mainnet assumptions

### 2. No event stream for price / state indexing beyond current basics

The pool emits trade events and state changes, but the indexing story is incomplete for analytics UX. Potential additions: floor-price update event, buyback-availability event, reserve health snapshots.

### 3. No explicit emergency reserve escape hatch design

This remains intentionally unimplemented. Possible options: no rescue at all, timelocked emergency withdrawal, multisig/DAO-controlled emergency path. The key is to decide deliberately.

### 4. Factory deployment on real networks unvalidated

Local tests prove constructor encoding and wiring, but there is no proof that the same flow works on a real network with gas constraints and external tooling.

## Recommended Priorities

### Do Now

1. Transfer live ownership to a multisig through `OWNER_ADDRESS` / `SAFE_ADDRESS`
2. Lock palette before any public mint
3. Validate direct deploy path on Sepolia and capture real gas + addresses
4. Validate factory deployment flow end-to-end on testnet
5. Keep deployment JSON and frontend appConfig in sync after each live deploy

### Do Before Any Public Testnet Push

6. Add staking UI to frontend
7. Decide emergency governance posture
8. Measure real deployment gas / calldata constraints on target network

### Do Before Mainnet

9. Move delayed router updates under multisig control in production
10. Professional audit of the `_settle()` fix and fee distribution math
11. Gas optimization pass on factory and pool
12. Event stream for analytics/indexing
