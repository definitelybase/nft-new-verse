# Dwellers Plan

This is the current roadmap for the real V1 direction, not the historical brainstorming path.

## Current Direction

V1 is now centered around five pieces:

1. fully on-chain pixel NFTs
2. router-driven mint and sell-to-pool flow
3. reserve-aware floor pool
4. native on-chain marketplace
5. Safe-based governance and operational control

The core product thesis is:

- mint seeds reserve
- pool handles the floor lane
- marketplace handles trading and premium discovery
- treasury handles weak-market cleanup
- stakers earn from real fee flow

## What V1 Includes

### Protocol

- on-chain mint
- on-chain art storage
- sell-to-pool floor exit
- protocol inventory handling
- treasury buyback
- vault and burn path
- staking
- native marketplace
- factory deploy path

### Operations

- Safe-ready ownership handoff
- palette lock in deployment flow
- delayed router replacement after setup
- deployment verification scripts

### Frontend

- protocol shell
- mint page
- marketplace page
- staking page
- pixel editor

## What V1 Does Not Include

- mainnet-ready external audit
- final professional frontend polish
- advanced analytics backend
- immutable governance
- external marketplace dependence as a core design assumption

## Current Priorities

### 1. Redeploy testnet under the new marketplace stack

The contract architecture changed.  
That means the live testnet deployment needs to match the current repository again:

- NFT
- Pool
- Router
- Marketplace

### 2. Wire frontend to the native marketplace

The contracts now support native listings and protocol settlement.  
The UI should surface that clearly and stop carrying old marketplace assumptions.

### 3. Clarify docs and public positioning

The public explanation should now be precise:

- native marketplace
- floor lane
- treasury cleanup
- staking from fees
- Safe governance

No vague "permanent floor support" language.

### 4. Run end-to-end market drills

We should test the whole loop on Sepolia:

1. mint
2. user listing
3. user purchase
4. sell into pool
5. release protocol inventory
6. buy protocol listing
7. staking reward accrual

### 5. Prepare an external review package

Before any serious public launch, the repo should have:

- stable docs
- stable deploy flow
- stable test coverage
- clear trust assumptions

That makes external review much easier and more useful.

## Before Public Testnet Push

Required:

1. Safe ownership on the active deployment
2. correct marketplace deployment and wiring
3. frontend pointed to the current live stack
4. docs consistent with contracts
5. manual end-to-end walkthrough completed

## Before Mainnet

Required:

1. independent audit
2. clear governance policy
3. real parameter review
4. final product polish
5. final decision on which admin powers remain and which eventually freeze

## Success Criteria For This Stage

This stage is successful if:

- a reader can understand the full system from the docs
- the live testnet matches the code in the repo
- the native marketplace flow works end-to-end
- the protocol is controlled by a Safe, not a personal wallet
- the team can explain risks without hand-waving

## Non-Negotiable Communication Rules

When describing the protocol publicly, we should stay honest:

- call the pool a floor lane, not a magic price oracle
- call governance what it is
- do not market unaudited code as finished
- do not imply guaranteed exit or guaranteed upside

That honesty is part of the product quality.
