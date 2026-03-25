# Emergency Governance Design

## Current Admin Surface

### PixelPool (holds user funds)
| Function | Risk | Current access |
|----------|------|---------------|
| `pause()` / `unpause()` | Freezes all trades, staking, claims | onlyOwner (EOA) |
| `setRouter(address)` | Controls who can seed liquidity, route trades | onlyOwner |
| `claimProtocolFees()` | Drains protocol fee accrual only | onlyOwner |

**No function exists to drain `ethBalance` or `treasuryBalance` directly.** The pool has `receive() external payable` but no admin withdrawal. ETH leaves only through:
- sell payouts to users
- staker fee claims
- protocol fee claims (capped to `protocolFees`)
- treasury buyback cycle (buys NFTs at floor, doesn't extract ETH)

### PixelRouter (transient custody only)
| Function | Risk | Current access |
|----------|------|---------------|
| `rescueNFT()` / `rescueETH()` | Recovers stuck assets | onlyOwner |
| `setMintPrice()`, `setCreator()` | Changes economics | onlyOwner |
| `setPoolSeedBps()`, `setTreasuryBps()` | Changes mint split | onlyOwner |

Router holds no persistent funds by design. Rescue functions exist for stuck assets only.

### OnChainPixelNFT
| Function | Risk | Current access |
|----------|------|---------------|
| `setMinter()`, `setBurner()` | Grants mint/burn authority | onlyOwner |
| `withdraw()` | Drains NFT contract's mint proceeds | onlyOwner |
| `setPalette()`, `lockPalette()` | Modifies art | onlyOwner (lockable) |

### PixelFactory
| Function | Risk | Current access |
|----------|------|---------------|
| `setNFTCode/setPoolCode/setRouterCode` | Changes deployment bytecode | onlyOwner |
| `setFactoryFee()` | Changes creation fee | onlyOwner |
| `withdraw()` | Drains factory fee balance | onlyOwner |

## Risk Assessment

**What can a compromised owner key do?**

1. **Pause the pool** — blocks all trades, staking, claims. Reversible by calling `unpause()`.
2. **Change router** — point pool to a malicious router that calls `seedLiquidity` to inflate `ethBalance` accounting, then routes sells to drain. This is the **highest-impact attack vector**.
3. **Change mint economics** — set mint price to 0, change splits. Visible on-chain.
4. **Grant minter/burner** — mint unlimited NFTs or burn others' NFTs.
5. **Cannot directly drain pool ETH** — no `withdraw()` on pool for ethBalance/treasuryBalance.

**What can a compromised owner NOT do?**

- Cannot drain pool reserves in a single transaction
- Cannot steal staked NFTs (unstake checks stakeOwner)
- Cannot claim other users' staking rewards
- Cannot bypass the pool's sell/buy market-state gates

## Options

### Option A: No change (current — single EOA owner)

**Pros:** Simple, fast response, no deployment complexity
**Cons:** Single point of failure. Key compromise = full admin control.

**Best for:** Early testnet phase, small user base, rapid iteration

### Option B: Multisig (Gnosis Safe)

Transfer ownership of Pool, Router, NFT to a 2-of-3 or 3-of-5 Safe.

**Pros:** No single key can act unilaterally. Standard pattern.
**Cons:** Slower emergency response (need multiple signers). Gas overhead per admin tx.

**Implementation:** Just `transferOwnership(safeAddress)` on each contract. No code changes.

**Best for:** Pre-mainnet through early mainnet. Can start 2-of-3 and upgrade to 3-of-5.

### Option C: Timelock + Multisig

Admin actions go through a TimelockController (e.g., 24h delay). Emergency pause bypasses the timelock.

**Pros:** Users can observe and exit before harmful admin actions execute. Pause stays instant.
**Cons:** More complex. Requires splitting pause from other admin functions. 24h delay means slower response for legitimate changes.

**Implementation:**
- Deploy OpenZeppelin TimelockController
- Transfer ownership of Pool/Router/NFT to timelock
- Keep a separate `pauser` role on Pool that bypasses timelock (requires contract change)
- Multisig controls the timelock's proposer/executor roles

**Contract change needed:**
```solidity
address public pauser;
function setPauser(address p) external onlyOwner { pauser = p; }
modifier onlyPauser() { require(msg.sender == pauser || msg.sender == owner(), "NotPauser"); _; }
function pause() external onlyPauser { _pause(); }
// unpause stays onlyOwner (through timelock)
```

**Best for:** Mainnet with meaningful TVL.

### Option D: Progressive decentralization

Phase 1 (testnet): EOA owner — current state
Phase 2 (early mainnet): 2-of-3 multisig — no code changes
Phase 3 (maturity): Timelock + multisig — requires pauser role change
Phase 4 (optional): DAO governance — much later, if ever

## Recommendation

**Start with Option B (multisig) at mainnet launch. Plan for Option C later.**

Reasoning:
- The biggest risk (setRouter) is mitigated by requiring multiple signers
- No code changes needed for Option B — just `transferOwnership` post-deploy
- pause/unpause stays fast because the multisig can execute directly
- The pool already has no admin drain function — the security surface is smaller than most DeFi
- Timelock adds value only when TVL justifies the complexity

**Immediate action:** None. Keep EOA for testnet. Before mainnet, deploy a Gnosis Safe and transfer ownership.

**Code change to prepare for Option C:** Add a `pauser` role to PixelPool that can call `pause()` without going through the timelock. This is a small, low-risk change that can be done now or later.

## setRouter: The Key Risk

`setRouter` is still the most dangerous admin function because it controls who can call `seedLiquidity` and `seedTreasury`, which mutate pool accounting. A malicious router could:

1. Inject real ETH in misleading ways that distort reserve/accounting expectations
2. Route trades through a malicious surface
3. Change how mint-seeded capital reaches the pool/treasury

**Mitigation options:**
- Make `setRouter` go through timelock even if other functions don't
- Add an event-monitoring alert on `RouterUpdated`
- Transfer ownership to a multisig before any meaningful TVL

Note: the old `seedLiquidity(0)` inflation concern is already closed in the current codebase. The remaining risk is governance/control over which router is trusted at all.
