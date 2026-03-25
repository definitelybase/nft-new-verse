// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IERC721Burnable is IERC721 {
    function protocolBurn(uint256 tokenId) external;
}

/// @title PixelPool
/// @notice Market-state-aware NFT floor-liquidity pool with staking and treasury buyback
/// @dev Uses a reserve-aware linear floor bid, conditional inventory sales, and gated buyback logic.
///      The pool is designed to provide floor liquidity when market conditions allow it,
///      not to guarantee permanent fair-value exits for every NFT.
contract PixelPool is IERC721Receiver, Ownable, ReentrancyGuard, Pausable {
    enum MarketState {
        Expansion,
        Stabilization,
        WeakDemand
    }

    error PoolEmpty();
    error InsufficientPayment();
    error NotNFTOwner();
    error NFTNotInPool();
    error TransferFailed();
    error InvalidAmount();
    error SlippageExceeded();
    error AlreadyStaked();
    error NotStaker();
    error NothingToClaim();
    error NotRouter();
    error BuybackNotActive();
    error RelistConditionsNotMet();
    error PoolBuyDisabled();
    error PoolSellDisabled();
    error ZeroAddress();
    error InvalidDependency();
    error RouterChangePending();
    error RouterChangeNotReady();
    error RouterChangeNotPending();

    event NFTSold(address indexed seller, uint256 indexed tokenId, uint256 price, uint256 fee);
    event NFTBought(address indexed buyer, uint256 indexed tokenId, uint256 price, uint256 fee);
    event LiquidityAdded(uint256 ethAmount);
    event TreasurySeeded(uint256 ethAmount);
    event NFTStaked(address indexed staker, uint256 indexed tokenId);
    event NFTUnstaked(address indexed staker, uint256 indexed tokenId);
    event FeesClaimed(address indexed staker, uint256 amount);
    event ProtocolFeesClaimed(address indexed to, uint256 amount);
    event TotalMintedUpdated(uint256 previousTotalMinted, uint256 newTotalMinted);
    event BuybackExecuted(uint256 bought, uint256 ethSpent, uint256 burned, uint256 vaulted);
    event VaultRelisted(uint256 count);
    event VaultBurned(uint256 count);
    event RouterChangeQueued(address indexed currentRouter, address indexed pendingRouter, uint256 activateAt);
    event RouterChangeCancelled(address indexed pendingRouter);
    event RouterUpdated(address indexed previousRouter, address indexed newRouter);
    event MarketStateUpdated(
        MarketState indexed previousState,
        MarketState indexed newState,
        uint256 volumeRatioBps,
        uint256 pressureRatioBps,
        uint256 floorDeviationBps
    );

    uint256 public constant TRADE_FEE_BPS = 250;
    uint256 public constant STAKER_FEE_BPS = 1000;
    uint256 public constant POOL_FEE_BPS = 2500;
    uint256 public constant BUYBACK_FEE_BPS = 2500;
    uint256 public constant PROTOCOL_FEE_BPS = 4000;
    uint256 private constant BPS = 10000;

    uint256 public constant SHORT_WINDOW = 6 hours;
    uint256 public constant LONG_WINDOW = 24 hours;
    uint256 public constant LAUNCH_PROTECTION = 6 hours;
    uint256 public constant INITIAL_BID_BPS = 6000;
    uint256 public constant MIN_BID_BPS = 1500;
    uint256 public constant BID_DECAY_SELLS = 3000;
    uint256 public constant EMA_FLOOR_BPS = 5000;
    uint256 public constant WEAK_DEMAND_BETA_BPS = 9000;
    uint256 public constant STABILIZATION_SPREAD_BPS = 2000;
    uint256 public constant TARGET_EXIT_BUFFER = 500;
    uint256 public constant BUYBACK_STEP_TREASURY_BPS = 500;
    uint256 public constant BUYBACK_STEP_POOL_BPS = 500;
    uint256 public constant INVENTORY_LOW = 50;
    uint256 public constant INVENTORY_TARGET = 150;
    uint256 public constant INVENTORY_HIGH = 300;
    uint256 public constant INVENTORY_STALE_AGE = 7 days;
    uint256 public constant VAULT_BURN_AGE = 14 days;
    uint256 public constant RELIST_PROFIT_BPS = 2000;
    uint256 public constant ROUTER_CHANGE_DELAY = 48 hours;

    IERC721Burnable public immutable nftContract;
    uint256 public immutable mintPrice;
    address public router;
    address public pendingRouter;
    uint256 public pendingRouterEta;
    uint256 public immutable launchTimestamp;

    uint256 public ethBalance;
    uint256 public totalSoldIntoPool;
    uint256 public protocolFees;
    uint256 public treasuryBalance;
    uint256 public totalMinted;
    uint256 public totalBurned;

    uint256[] private _poolNfts;
    mapping(uint256 => uint256) private _poolIdx;
    mapping(uint256 => bool) public isInPool;
    mapping(uint256 => uint256) public poolListedAt;

    uint256 public totalStaked;
    uint256 public accFeePerStake;
    mapping(uint256 => address) public stakedBy;
    mapping(address => uint256) public stakedCount;
    mapping(address => uint256[]) private _userStaked;
    mapping(uint256 => uint256) private _userStakedIdx;
    mapping(address => uint256) public rewardDebt;
    mapping(address => uint256) public pendingRewards;

    MarketState public marketState;
    uint256 public floorEma;
    uint256 public shortWindowStart;
    uint256 public longWindowStart;
    uint256 public shortWindowVolume;
    uint256 public longWindowVolume;
    uint256 public shortWindowBuys;
    uint256 public shortWindowSells;
    uint256 public longWindowBuys;
    uint256 public longWindowSells;

    uint256 public oldestPoolListedAt;

    uint256[] private _vaultNfts;
    mapping(uint256 => uint256) private _vaultIdx;
    mapping(uint256 => bool) public isInVault;
    mapping(uint256 => uint256) public buybackPrice;
    mapping(uint256 => uint256) public vaultStoredAt;

    constructor(address nft_, uint256 mintPrice_) Ownable() {
        if (nft_ == address(0)) revert ZeroAddress();
        if (nft_.code.length == 0) revert InvalidDependency();
        if (mintPrice_ == 0) revert InvalidAmount();
        nftContract = IERC721Burnable(nft_);
        mintPrice = mintPrice_;
        launchTimestamp = block.timestamp;
        marketState = MarketState.Expansion;
        floorEma = (mintPrice_ * INITIAL_BID_BPS) / BPS;
        shortWindowStart = block.timestamp;
        longWindowStart = block.timestamp;
    }

    function seedLiquidity() external payable { _onlyRouter(); if (msg.value == 0) revert PoolEmpty(); ethBalance += msg.value; emit LiquidityAdded(msg.value); }
    function seedTreasury() external payable { _onlyRouter(); treasuryBalance += msg.value; emit TreasurySeeded(msg.value); }
    function setTotalMinted(uint256 c) external {
        _onlyRouter();
        if (c < totalMinted) revert InvalidAmount();
        emit TotalMintedUpdated(totalMinted, c);
        totalMinted = c;
    }
    function _onlyRouter() private view { if (msg.sender != router) revert NotRouter(); }

    // ---- Floor Pricing ----
    function getFloorPrice() public view returns (uint256) {
        uint256 initialBid = (mintPrice * INITIAL_BID_BPS) / BPS;
        uint256 minBid = (mintPrice * MIN_BID_BPS) / BPS;
        uint256 curveBid = totalSoldIntoPool >= BID_DECAY_SELLS
            ? minBid
            : initialBid - (((initialBid - minBid) * totalSoldIntoPool) / BID_DECAY_SELLS);
        uint256 emaFloor = floorEma == 0 ? curveBid : (floorEma * EMA_FLOOR_BPS) / BPS;
        if (emaFloor < minBid) emaFloor = minBid;
        return curveBid > emaFloor ? curveBid : emaFloor;
    }
    function getSellPrice() public view returns (uint256) {
        if (!canSellIntoPool()) return 0;
        return getFloorPrice();
    }
    function getBuyPrice() public view returns (uint256) {
        if (!canBuyFromPool()) return 0;
        return _applySpread(getFloorPrice());
    }

    function getMarketSignals() public view returns (
        uint256 volumeRatioBps,
        uint256 pressureRatioBps,
        uint256 floorDeviationBps,
        uint256 coverageRatioBps
    ) {
        uint256 shortVol = shortWindowVolume;
        uint256 longVol = longWindowVolume;
        uint256 ema = floorEma == 0 ? getFloorPrice() : floorEma;
        uint256 floor = getFloorPrice();
        uint256 normalizedLong = longVol / 4;
        if (normalizedLong == 0) volumeRatioBps = BPS;
        else volumeRatioBps = (shortVol * BPS) / normalizedLong;

        if (shortWindowBuys == 0) {
            pressureRatioBps = shortWindowSells == 0 ? BPS : type(uint256).max;
        } else {
            pressureRatioBps = (shortWindowSells * BPS) / shortWindowBuys;
        }

        floorDeviationBps = ema == 0 ? BPS : (floor * BPS) / ema;
        coverageRatioBps = _coverageRatio(floor);
    }

    function getInventoryBands() external pure returns (uint256 low, uint256 target, uint256 high) {
        return (INVENTORY_LOW, INVENTORY_TARGET, INVENTORY_HIGH);
    }

    function getOldestPoolInventoryAge() public view returns (uint256 age) {
        if (_poolNfts.length == 0 || oldestPoolListedAt == 0) return 0;
        return block.timestamp - oldestPoolListedAt;
    }

    function canSellIntoPool() public view returns (bool) {
        if (block.timestamp < launchTimestamp + LAUNCH_PROTECTION) return false;
        if (marketState == MarketState.Expansion) return false;
        return _coverageRatio(getFloorPrice()) >= BPS;
    }

    function canBuyFromPool() public view returns (bool) {
        return marketState == MarketState.Stabilization && _poolNfts.length > 0;
    }

    // ---- Sell ----
    function sell(uint256 tokenId, uint256 minPrice) external nonReentrant whenNotPaused {
        _rollWindows();
        _refreshMarketState();
        if (!canSellIntoPool()) revert PoolSellDisabled();
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        uint256 price = getSellPrice();
        if (price == 0 || price < minPrice) revert SlippageExceeded();
        uint256 fee = (price * TRADE_FEE_BPS) / BPS;
        uint256 payout = price - fee;
        if (payout > ethBalance) revert PoolEmpty();
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        _addPool(tokenId); totalSoldIntoPool += 1;
        _recordTrade(price, false);
        _distFee(fee); ethBalance -= payout; _updateFloorEma();
        _refreshMarketState();
        (bool ok,) = msg.sender.call{value: payout}(""); if (!ok) revert TransferFailed();
        emit NFTSold(msg.sender, tokenId, price, fee);
    }

    // ---- Buy ----
    function buy(uint256 maxPrice) external payable nonReentrant whenNotPaused returns (uint256 tokenId) {
        _rollWindows();
        _refreshMarketState();
        if (!canBuyFromPool()) revert PoolBuyDisabled();
        if (_poolNfts.length == 0) revert PoolEmpty();
        uint256 price = getBuyPrice(); uint256 fee = (price * TRADE_FEE_BPS) / BPS; uint256 cost = price + fee;
        if (cost > maxPrice) revert SlippageExceeded(); if (msg.value < cost) revert InsufficientPayment();
        tokenId = _poolNfts[_poolNfts.length - 1]; _rmPool(tokenId);
        if (totalSoldIntoPool > 0) totalSoldIntoPool -= 1;
        _recordTrade(price, true);
        _distFee(fee); ethBalance += price; _updateFloorEma();
        _refreshMarketState();
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        uint256 ref = msg.value - cost;
        if (ref > 0) { (bool ok,) = msg.sender.call{value: ref}(""); if (!ok) revert TransferFailed(); }
        emit NFTBought(msg.sender, tokenId, price, fee);
    }

    function buySpecific(uint256 tokenId, uint256 maxPrice) external payable nonReentrant whenNotPaused {
        _rollWindows();
        _refreshMarketState();
        if (!canBuyFromPool()) revert PoolBuyDisabled();
        if (!isInPool[tokenId]) revert NFTNotInPool();
        uint256 price = getBuyPrice(); uint256 fee = (price * TRADE_FEE_BPS) / BPS; uint256 cost = price + fee;
        if (cost > maxPrice) revert SlippageExceeded(); if (msg.value < cost) revert InsufficientPayment();
        _rmPool(tokenId); if (totalSoldIntoPool > 0) totalSoldIntoPool -= 1;
        _recordTrade(price, true);
        _distFee(fee); ethBalance += price; _updateFloorEma();
        _refreshMarketState();
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        uint256 ref = msg.value - cost;
        if (ref > 0) { (bool ok,) = msg.sender.call{value: ref}(""); if (!ok) revert TransferFailed(); }
        emit NFTBought(msg.sender, tokenId, price, fee);
    }

    // ---- Staking ----
    function stake(uint256 tokenId) external nonReentrant {
        if (stakedBy[tokenId] != address(0)) revert AlreadyStaked();
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        _settle(msg.sender);
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        stakedBy[tokenId] = msg.sender;
        _userStakedIdx[tokenId] = _userStaked[msg.sender].length;
        _userStaked[msg.sender].push(tokenId);
        stakedCount[msg.sender] += 1; totalStaked += 1;
        rewardDebt[msg.sender] = stakedCount[msg.sender] * accFeePerStake;
        emit NFTStaked(msg.sender, tokenId);
    }
    function unstake(uint256 tokenId) external nonReentrant {
        if (stakedBy[tokenId] != msg.sender) revert NotStaker();
        _settle(msg.sender);
        stakedBy[tokenId] = address(0); _rmUserStaked(msg.sender, tokenId);
        stakedCount[msg.sender] -= 1; totalStaked -= 1;
        rewardDebt[msg.sender] = stakedCount[msg.sender] * accFeePerStake;
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        uint256 p = pendingRewards[msg.sender];
        if (p > 0) { pendingRewards[msg.sender] = 0; (bool ok,) = msg.sender.call{value: p}(""); if (!ok) revert TransferFailed(); emit FeesClaimed(msg.sender, p); }
        emit NFTUnstaked(msg.sender, tokenId);
    }
    function claimFees() external nonReentrant {
        _settle(msg.sender); uint256 p = pendingRewards[msg.sender]; if (p == 0) revert NothingToClaim();
        rewardDebt[msg.sender] = stakedCount[msg.sender] * accFeePerStake;
        pendingRewards[msg.sender] = 0; (bool ok,) = msg.sender.call{value: p}(""); if (!ok) revert TransferFailed();
        emit FeesClaimed(msg.sender, p);
    }
    function viewPendingFees(address u) external view returns (uint256) {
        return pendingRewards[u] + ((stakedCount[u] * accFeePerStake - rewardDebt[u]) / 1e18);
    }
    function getUserStakedTokens(address u) external view returns (uint256[] memory) { return _userStaked[u]; }

    // ---- Treasury Buyback ----
    function getBuybackMode() public view returns (uint8 mode, uint256 maxBuy) {
        (uint256 volumeRatioBps, uint256 pressureRatioBps, uint256 floorDeviationBps, uint256 coverageRatioBps) =
            getMarketSignals();
        uint256 price = getFloorPrice();
        bool staleInventory = getOldestPoolInventoryAge() >= INVENTORY_STALE_AGE;
        bool excessInventory = _poolNfts.length > INVENTORY_HIGH;
        bool weakMarket =
            marketState == MarketState.WeakDemand &&
            volumeRatioBps < 7500 &&
            pressureRatioBps > 12500 &&
            floorDeviationBps < WEAK_DEMAND_BETA_BPS;
        if (
            !(staleInventory || excessInventory || weakMarket) ||
            coverageRatioBps < 20000
        ) return (0, 0);

        uint256 treasuryBudget = (treasuryBalance * BUYBACK_STEP_TREASURY_BPS) / BPS;
        uint256 poolGuardrail = (ethBalance * BUYBACK_STEP_POOL_BPS) / BPS;
        uint256 budget = treasuryBudget < poolGuardrail ? treasuryBudget : poolGuardrail;
        uint256 count = price > 0 ? budget / price : 0;
        if (count == 0) return (0, 0);
        if (count > _poolNfts.length) count = _poolNfts.length;
        if (count > 5) count = 5;
        return (1, count);
    }

    function executeBuyback() external nonReentrant {
        _rollWindows();
        _refreshMarketState();
        (uint8 mode, uint256 maxBuy) = getBuybackMode();
        if (mode == 0) revert BuybackNotActive();
        uint256 spent; uint256 bought; uint256 burned; uint256 vaulted;
        for (uint256 i = 0; i < maxBuy; i++) {
            if (_poolNfts.length == 0) break;
            uint256 f = getFloorPrice(); if (f == 0 || f > treasuryBalance) break;
            treasuryBalance -= f;
            ethBalance += f;
            uint256 tid = _poolNfts[_poolNfts.length - 1]; _rmPool(tid);
            spent += f; bought += 1;
            if (totalSoldIntoPool > 0) totalSoldIntoPool -= 1;
            if (bought % 5 == 0) { nftContract.protocolBurn(tid); totalBurned++; burned++; }
            else { buybackPrice[tid] = f; _addVault(tid); vaulted++; }
        }
        if (bought == 0) revert BuybackNotActive();
        uint256 bounty = spent / 1000;
        if (bounty > 0 && bounty <= treasuryBalance) { treasuryBalance -= bounty; (bool ok,) = msg.sender.call{value: bounty}(""); if (!ok) revert TransferFailed(); }
        _updateFloorEma();
        _refreshMarketState();
        emit BuybackExecuted(bought, spent, burned, vaulted);
    }

    function burnAgedVaultInventory(uint256 maxCount) external nonReentrant returns (uint256 burned) {
        uint256 idx = _vaultNfts.length;
        while (idx > 0 && burned < maxCount) {
            uint256 currentIdx = idx - 1;
            uint256 tid = _vaultNfts[currentIdx];
            idx = currentIdx;
            if (block.timestamp - vaultStoredAt[tid] < VAULT_BURN_AGE) continue;
            _rmVault(tid);
            nftContract.protocolBurn(tid);
            totalBurned += 1;
            burned += 1;
        }
        if (burned == 0) revert BuybackNotActive();
        emit VaultBurned(burned);
    }

    function relistFromVault(uint256 count) external nonReentrant {
        if (marketState != MarketState.Stabilization) revert RelistConditionsNotMet();
        if (_poolNfts.length >= INVENTORY_LOW) revert RelistConditionsNotMet();
        uint256 ask = getBuyPrice(); uint256 done;
        for (uint256 i = 0; i < count; i++) {
            if (_vaultNfts.length == 0 || _poolNfts.length >= INVENTORY_LOW) break;
            uint256 tid = _vaultNfts[_vaultNfts.length - 1];
            uint256 minP = (buybackPrice[tid] * (BPS + RELIST_PROFIT_BPS)) / BPS;
            if (ask < minP) break;
            _rmVault(tid); _addPool(tid); done++;
        }
        if (done == 0) revert RelistConditionsNotMet();
        emit VaultRelisted(done);
    }

    // ---- Metrics ----
    function getMarketMetrics() external view returns (
        uint256 effectiveFloor, uint256 circulatingSupply, uint256 lockedSupply,
        uint256 poolSupply, uint256 poolETH, uint256 effectiveMarketCap, uint256 liquidityRatio
    ) {
        effectiveFloor = getFloorPrice(); lockedSupply = totalStaked; poolSupply = _poolNfts.length;
        uint256 t = totalMinted > totalBurned ? totalMinted - totalBurned : 0;
        circulatingSupply = t > lockedSupply + poolSupply ? t - lockedSupply - poolSupply : 0;
        poolETH = ethBalance;
        effectiveMarketCap = (circulatingSupply + lockedSupply) * effectiveFloor + poolETH;
        liquidityRatio = effectiveMarketCap > 0 ? (poolETH * BPS) / effectiveMarketCap : 0;
    }

    function availableNFTs() external view returns (uint256) { return _poolNfts.length; }
    function getPoolNFTs() external view returns (uint256[] memory) { return _poolNfts; }
    function vaultSize() external view returns (uint256) { return _vaultNfts.length; }

    // ---- Admin ----
    function setRouter(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        if (pendingRouter != address(0)) revert RouterChangePending();
        if (router == address(0) || block.timestamp < launchTimestamp + LAUNCH_PROTECTION) {
            emit RouterUpdated(router, r);
            router = r;
            return;
        }
        pendingRouter = r;
        pendingRouterEta = block.timestamp + ROUTER_CHANGE_DELAY;
        emit RouterChangeQueued(router, r, pendingRouterEta);
    }
    function applyRouterUpdate() external onlyOwner {
        address next = pendingRouter;
        if (next == address(0)) revert RouterChangeNotPending();
        if (block.timestamp < pendingRouterEta) revert RouterChangeNotReady();
        address previous = router;
        delete pendingRouter;
        delete pendingRouterEta;
        router = next;
        emit RouterUpdated(previous, next);
    }
    function cancelRouterUpdate() external onlyOwner {
        address queued = pendingRouter;
        if (queued == address(0)) revert RouterChangeNotPending();
        delete pendingRouter;
        delete pendingRouterEta;
        emit RouterChangeCancelled(queued);
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function claimProtocolFees() external onlyOwner {
        uint256 a = protocolFees; if (a == 0) revert NothingToClaim(); protocolFees = 0;
        (bool ok,) = msg.sender.call{value: a}(""); if (!ok) revert TransferFailed();
        emit ProtocolFeesClaimed(msg.sender, a);
    }

    // ---- Internal ----
    function _distFee(uint256 fee) private {
        uint256 s = (fee * STAKER_FEE_BPS) / BPS; uint256 p = (fee * POOL_FEE_BPS) / BPS;
        uint256 b = (fee * BUYBACK_FEE_BPS) / BPS; uint256 pr = fee - s - p - b;
        protocolFees += pr; ethBalance += p; treasuryBalance += b;
        if (totalStaked > 0) accFeePerStake += (s * 1e18) / totalStaked; else ethBalance += s;
    }
    function _settle(address u) private { if (stakedCount[u] > 0) { pendingRewards[u] += ((stakedCount[u] * accFeePerStake) - rewardDebt[u]) / 1e18; rewardDebt[u] = stakedCount[u] * accFeePerStake; } }
    function _addPool(uint256 id) private {
        _poolIdx[id] = _poolNfts.length;
        _poolNfts.push(id);
        isInPool[id] = true;
        poolListedAt[id] = block.timestamp;
        if (oldestPoolListedAt == 0 || block.timestamp < oldestPoolListedAt) {
            oldestPoolListedAt = block.timestamp;
        }
    }
    function _rmPool(uint256 id) private {
        bool wasOldest = poolListedAt[id] == oldestPoolListedAt;
        uint256 i = _poolIdx[id];
        uint256 l = _poolNfts.length - 1;
        if (i != l) {
            uint256 li = _poolNfts[l];
            _poolNfts[i] = li;
            _poolIdx[li] = i;
        }
        _poolNfts.pop();
        delete _poolIdx[id];
        delete poolListedAt[id];
        isInPool[id] = false;
        // Only recompute oldest when we removed the oldest item
        if (_poolNfts.length == 0) {
            oldestPoolListedAt = 0;
        } else if (wasOldest) {
            uint256 oldest = type(uint256).max;
            uint256 length = _poolNfts.length;
            for (uint256 j = 0; j < length; j++) {
                uint256 t = poolListedAt[_poolNfts[j]];
                if (t > 0 && t < oldest) oldest = t;
            }
            oldestPoolListedAt = oldest == type(uint256).max ? 0 : oldest;
        }
    }
    function _addVault(uint256 id) private {
        _vaultIdx[id] = _vaultNfts.length;
        _vaultNfts.push(id);
        isInVault[id] = true;
        vaultStoredAt[id] = block.timestamp;
    }
    function _rmVault(uint256 id) private {
        uint256 i = _vaultIdx[id];
        uint256 l = _vaultNfts.length - 1;
        if (i != l) {
            uint256 li = _vaultNfts[l];
            _vaultNfts[i] = li;
            _vaultIdx[li] = i;
        }
        _vaultNfts.pop();
        delete _vaultIdx[id];
        delete vaultStoredAt[id];
        isInVault[id] = false;
    }
    function _rmUserStaked(address u, uint256 id) private { uint256 i=_userStakedIdx[id]; uint256 l=_userStaked[u].length-1; if(i!=l){uint256 li=_userStaked[u][l];_userStaked[u][i]=li;_userStakedIdx[li]=i;} _userStaked[u].pop(); delete _userStakedIdx[id]; }

    function _rollWindows() private {
        if (block.timestamp >= shortWindowStart + SHORT_WINDOW) {
            shortWindowStart = block.timestamp;
            shortWindowVolume = 0;
            shortWindowBuys = 0;
            shortWindowSells = 0;
        }
        if (block.timestamp >= longWindowStart + LONG_WINDOW) {
            longWindowStart = block.timestamp;
            longWindowVolume = 0;
            longWindowBuys = 0;
            longWindowSells = 0;
        }
    }

    function _recordTrade(uint256 value, bool isBuy) private {
        shortWindowVolume += value;
        longWindowVolume += value;
        if (isBuy) {
            shortWindowBuys += 1;
            longWindowBuys += 1;
        } else {
            shortWindowSells += 1;
            longWindowSells += 1;
        }
    }

    function _updateFloorEma() private {
        uint256 floor = getFloorPrice();
        if (floorEma == 0) floorEma = floor;
        else floorEma = ((floorEma * 7) + floor) / 8;
    }

    function _refreshMarketState() private {
        MarketState previous = marketState;
        MarketState next;

        if (block.timestamp < launchTimestamp + LAUNCH_PROTECTION) {
            next = MarketState.Expansion;
        } else {
            (uint256 volumeRatioBps, uint256 pressureRatioBps, uint256 floorDeviationBps,) = getMarketSignals();
            if (
                volumeRatioBps > 12000 &&
                pressureRatioBps < 12000 &&
                floorDeviationBps >= 9800
            ) {
                next = MarketState.Expansion;
            } else if (
                volumeRatioBps >= 8000 &&
                volumeRatioBps <= 12000 &&
                floorDeviationBps >= 9500 &&
                floorDeviationBps <= 10500
            ) {
                next = MarketState.Stabilization;
            } else {
                next = MarketState.WeakDemand;
            }
        }

        marketState = next;
        if (previous != next) {
            (uint256 volumeRatioBps2, uint256 pressureRatioBps2, uint256 floorDeviationBps2,) = getMarketSignals();
            emit MarketStateUpdated(previous, next, volumeRatioBps2, pressureRatioBps2, floorDeviationBps2);
        }
    }

    function _applySpread(uint256 floor) private pure returns (uint256) {
        return floor + ((floor * STABILIZATION_SPREAD_BPS) / BPS);
    }

    function _coverageRatio(uint256 floor) private view returns (uint256) {
        if (floor == 0) return type(uint256).max;
        uint256 target = floor * TARGET_EXIT_BUFFER;
        if (target == 0) return type(uint256).max;
        return (ethBalance * BPS) / target;
    }

    function onERC721Received(address,address,uint256,bytes calldata) external pure override returns(bytes4) { return IERC721Receiver.onERC721Received.selector; }
    receive() external payable {}
}
