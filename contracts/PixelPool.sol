// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IERC721Burnable is IERC721 {
    function protocolBurn(uint256 tokenId) external;
    function totalSupply() external view returns (uint256);
    function maxSupply() external view returns (uint256);
}

interface IListingVenueSignals {
    function getMarketSnapshot() external view returns (uint256 sales24h, uint256 activeListings, uint256 floorPrice);
    function paused() external view returns (bool);
}

/// @title PixelPool
/// @notice Market-state-aware NFT floor-liquidity pool with staking and treasury buyback
/// @dev Uses a reserve-aware linear floor bid, external listing releases, and gated buyback logic.
///      The pool is designed to provide floor liquidity when market conditions allow it,
///      not to guarantee permanent fair-value exits for every NFT.
contract PixelPool is IERC721Receiver, Ownable, ReentrancyGuard, Pausable {
    enum MarketState {
        Expansion,
        Stabilization,
        WeakDemand
    }

    error PoolEmpty();
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
    error ListingReleaseDisabled();
    error PoolSellDisabled();
    error ZeroAddress();
    error InvalidDependency();
    error ListingVaultNotSet();
    error RouterChangePending();
    error RouterChangeNotReady();
    error RouterChangeNotPending();
    error ExternalListingNotTracked();
    error NotListingVenue();
    error ManualSnapshotDisabled();
    error ManualSnapshotModeInactive();

    event NFTSold(address indexed seller, uint256 indexed tokenId, uint256 price, uint256 fee);
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
    event ListingVaultUpdated(address indexed previousVault, address indexed newVault);
    event InventoryReleasedForListing(uint256 indexed tokenId, address indexed listingVault, uint256 referencePrice, bool fromVault);
    event RouterChangeQueued(address indexed currentRouter, address indexed pendingRouter, uint256 activateAt);
    event RouterChangeCancelled(address indexed pendingRouter);
    event RouterUpdated(address indexed previousRouter, address indexed newRouter);
    event ExternalMarketSnapshotUpdated(
        uint256 sales24h,
        uint256 activeListings,
        uint256 externalFloor,
        uint256 updatedAt
    );
    event ManualSnapshotModeUpdated(bool enabled, uint256 expiresAt);
    event ExternalSaleConfirmed(
        uint256 indexed tokenId,
        uint256 salePrice,
        bool fromPoolInventory
    );
    event ProtocolListingReturned(uint256 indexed tokenId, bool fromPoolInventory);
    event MarketStateUpdated(
        MarketState indexed previousState,
        MarketState indexed newState,
        uint256 purchaseRateBps,
        uint256 listingPressureBps,
        uint256 floorRatioBps
    );

    uint256 public constant TRADE_FEE_BPS = 250;
    uint256 public constant STAKER_FEE_BPS = 1000;
    uint256 public constant POOL_FEE_BPS = 2500;
    uint256 public constant BUYBACK_FEE_BPS = 2500;
    uint256 public constant PROTOCOL_FEE_BPS = 4000;
    uint256 private constant BPS = 10000;

    uint256 public constant LAUNCH_PROTECTION = 6 hours;
    uint256 public constant INITIAL_BID_BPS = 6000;
    uint256 public constant MIN_BID_BPS = 1500;
    uint256 public constant BID_DECAY_SELLS = 3000;
    uint256 public constant EMA_FLOOR_BPS = 5000;
    uint256 public constant STABILIZATION_SPREAD_BPS = 2000;
    uint256 public constant TARGET_EXIT_BUFFER = 500;
    uint256 public constant BUYBACK_STEP_TREASURY_BPS = 1000;
    uint256 public constant BUYBACK_STEP_POOL_BPS = 500;
    uint256 public constant INVENTORY_LOW = 50;
    uint256 public constant INVENTORY_TARGET = 150;
    uint256 public constant INVENTORY_HIGH = 300;
    uint256 public constant INVENTORY_STALE_AGE = 7 days;
    uint256 public constant VAULT_BURN_AGE = 14 days;
    uint256 public constant RELIST_PROFIT_BPS = 2000;
    uint256 public constant ROUTER_CHANGE_DELAY = 48 hours;
    uint256 public constant MANUAL_SNAPSHOT_TTL = 30 minutes;
    uint256 public constant MANUAL_MODE_MAX_DURATION = 1 hours;
    uint256 public constant EXPANSION_PURCHASE_RATE_BPS = 35;
    uint256 public constant EXPANSION_LISTING_PRESSURE_BPS = 800;
    uint256 public constant EXPANSION_FLOOR_RATIO_BPS = 12000;
    uint256 public constant RELEASE_PURCHASE_RATE_BPS = 15;
    uint256 public constant RELEASE_LISTING_PRESSURE_BPS = 1200;
    uint256 public constant RELEASE_FLOOR_RATIO_BPS = 12000;
    uint256 public constant WEAK_DEMAND_PURCHASE_RATE_BPS = 10;
    uint256 public constant WEAK_DEMAND_LISTING_PRESSURE_BPS = 1500;
    uint256 public constant WEAK_DEMAND_FLOOR_RATIO_BPS = 10000;

    IERC721Burnable public immutable nftContract;
    uint256 public immutable mintPrice;
    address public router;
    address public listingVault;
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
    uint256 public externalSales24h;
    uint256 public externalListings;
    uint256 public externalFloor;
    uint256 public externalSnapshotAt;
    uint256 public manualSnapshotExpiresAt;

    uint256 public oldestPoolListedAt;

    uint256[] private _vaultNfts;
    mapping(uint256 => uint256) private _vaultIdx;
    mapping(uint256 => bool) public isInVault;
    mapping(uint256 => uint256) public buybackPrice;
    mapping(uint256 => uint256) public vaultStoredAt;
    mapping(uint256 => bool) public pendingExternalSale;
    mapping(uint256 => bool) public pendingExternalSaleFromPool;

    constructor(address nft_, uint256 mintPrice_) Ownable() {
        if (nft_ == address(0)) revert ZeroAddress();
        if (nft_.code.length == 0) revert InvalidDependency();
        if (mintPrice_ == 0) revert InvalidAmount();
        nftContract = IERC721Burnable(nft_);
        mintPrice = mintPrice_;
        launchTimestamp = block.timestamp;
        marketState = MarketState.Expansion;
        floorEma = (mintPrice_ * INITIAL_BID_BPS) / BPS;
        externalFloor = floorEma;
        externalSnapshotAt = block.timestamp;
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
    function _onlyListingVenue() private view { if (msg.sender != listingVault) revert NotListingVenue(); }

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
    function getListingPrice() public view returns (uint256) {
        return _applySpread(getFloorPrice());
    }

    function getMarketSignals() public view returns (
        uint256 purchaseRateBps,
        uint256 listingPressureBps,
        uint256 floorRatioBps,
        uint256 coverageRatioBps
    ) {
        uint256 liveSupply = _referenceSupply();
        uint256 protocolFloor = getFloorPrice();
        uint256 observedSales24h;
        uint256 observedListings;
        uint256 observedFloor;
        bool manualActive = _manualSnapshotActive();
        bool venuePaused;
        bool venuePauseKnown;

        if (manualActive) {
            observedSales24h = externalSales24h;
            observedListings = externalListings;
            observedFloor = externalFloor;
        }

        if (!manualActive && listingVault != address(0) && listingVault.code.length > 0) {
            try IListingVenueSignals(listingVault).paused() returns (bool isPaused) {
                venuePaused = isPaused;
                venuePauseKnown = true;
            } catch {}

            if (!venuePauseKnown || !venuePaused) {
                try IListingVenueSignals(listingVault).getMarketSnapshot() returns (
                    uint256 sales24h,
                    uint256 activeListings,
                    uint256 floorPrice
                ) {
                    if (sales24h > 0 || activeListings > 0 || floorPrice > 0) {
                        observedSales24h = sales24h;
                        observedListings = activeListings;
                        observedFloor = floorPrice;
                    }
                } catch {}
            }
        }

        if (liveSupply > 0) {
            purchaseRateBps = (observedSales24h * BPS) / liveSupply;
            listingPressureBps = (observedListings * BPS) / liveSupply;
        }

        if (protocolFloor == 0) {
            floorRatioBps = BPS;
        } else if (observedListings == 0 || observedFloor == 0) {
            floorRatioBps = observedSales24h > 0 ? EXPANSION_FLOOR_RATIO_BPS : BPS;
        } else {
            floorRatioBps = (observedFloor * BPS) / protocolFloor;
        }
        coverageRatioBps = _coverageRatio(protocolFloor);
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

    function canReleaseInventoryForListing() public view returns (bool) {
        if (
            marketState != MarketState.Stabilization ||
            listingVault == address(0) ||
            (_poolNfts.length == 0 && _vaultNfts.length == 0)
        ) return false;

        (uint256 purchaseRateBps, uint256 listingPressureBps, uint256 floorRatioBps,) = getMarketSignals();
        return _isReleaseSignal(purchaseRateBps, listingPressureBps, floorRatioBps);
    }

    // ---- Sell ----
    function sell(uint256 tokenId, uint256 minPrice) external nonReentrant whenNotPaused {
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
        _distFee(fee); ethBalance -= payout; _updateFloorEma();
        _refreshMarketState();
        (bool ok,) = msg.sender.call{value: payout}(""); if (!ok) revert TransferFailed();
        emit NFTSold(msg.sender, tokenId, price, fee);
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
        (, , , uint256 coverageRatioBps) = getMarketSignals();
        uint256 price = getFloorPrice();
        bool staleInventory = getOldestPoolInventoryAge() >= INVENTORY_STALE_AGE;
        bool excessInventory = _poolNfts.length > INVENTORY_HIGH;
        bool weakMarket = marketState == MarketState.WeakDemand;
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
        if (count > 8) count = 8;
        return (1, count);
    }

    function executeBuyback() external nonReentrant {
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

    function relistFromVault(uint256 count) external onlyOwner nonReentrant whenNotPaused {
        if (listingVault == address(0)) revert ListingVaultNotSet();
        if (!canReleaseInventoryForListing()) revert RelistConditionsNotMet();
        uint256 observedFloor = externalFloor;
        if (listingVault.code.length > 0) {
            try IListingVenueSignals(listingVault).getMarketSnapshot() returns (
                uint256,
                uint256,
                uint256 floorPrice
            ) {
                if (floorPrice > 0) {
                    observedFloor = floorPrice;
                }
            } catch {
                // keep fallback snapshot
            }
        }
        uint256 done;
        for (uint256 i = 0; i < count; i++) {
            if (_vaultNfts.length == 0) break;
            uint256 tid = _vaultNfts[_vaultNfts.length - 1];
            uint256 targetPrice = getVaultListingTarget(tid);
            if (observedFloor < targetPrice) break;
            _rmVault(tid);
            _trackExternalListing(tid, false);
            nftContract.safeTransferFrom(address(this), listingVault, tid, abi.encode(targetPrice, false));
            emit InventoryReleasedForListing(tid, listingVault, targetPrice, true);
            done++;
        }
        if (done == 0) revert RelistConditionsNotMet();
        emit VaultRelisted(done);
    }

    function releasePoolInventoryForListing(uint256 count) external onlyOwner nonReentrant whenNotPaused {
        if (listingVault == address(0)) revert ListingVaultNotSet();
        _refreshMarketState();
        if (!canReleaseInventoryForListing()) revert ListingReleaseDisabled();
        uint256 ask = getListingPrice();
        uint256 done;
        for (uint256 i = 0; i < count; i++) {
            if (_poolNfts.length == 0) break;
            uint256 tid = _poolNfts[_poolNfts.length - 1];
            _rmPool(tid);
            _trackExternalListing(tid, true);
            nftContract.safeTransferFrom(address(this), listingVault, tid, abi.encode(ask, true));
            emit InventoryReleasedForListing(tid, listingVault, ask, false);
            done++;
        }
        if (done == 0) revert PoolEmpty();
        _updateFloorEma();
        _refreshMarketState();
    }

    function getVaultListingTarget(uint256 tokenId) public view returns (uint256) {
        return (buybackPrice[tokenId] * (BPS + RELIST_PROFIT_BPS)) / BPS;
    }

    function enableManualSnapshotMode(uint256 duration) external onlyOwner whenPaused {
        if (!_manualSnapshotVenueReady()) revert ManualSnapshotDisabled();
        if (duration == 0 || duration > MANUAL_MODE_MAX_DURATION) revert InvalidAmount();
        manualSnapshotExpiresAt = block.timestamp + duration;
        externalSnapshotAt = 0;
        emit ManualSnapshotModeUpdated(true, manualSnapshotExpiresAt);
    }

    function disableManualSnapshotMode() external onlyOwner {
        delete manualSnapshotExpiresAt;
        delete externalSnapshotAt;
        emit ManualSnapshotModeUpdated(false, 0);
    }

    function setExternalMarketSnapshot(
        uint256 sales24h,
        uint256 activeListings,
        uint256 floor
    ) external onlyOwner whenPaused {
        if (!_manualSnapshotModeActive()) revert ManualSnapshotModeInactive();
        if (!_manualSnapshotVenueReady()) revert ManualSnapshotDisabled();
        externalSales24h = sales24h;
        externalListings = activeListings;
        externalFloor = floor;
        externalSnapshotAt = block.timestamp;
        _refreshMarketState();
        emit ExternalMarketSnapshotUpdated(sales24h, activeListings, floor, externalSnapshotAt);
    }

    function recordMarketplaceFee() external payable nonReentrant {
        _onlyListingVenue();
        if (msg.value == 0) revert InvalidAmount();
        _distFee(msg.value);
        _refreshMarketState();
    }

    function settleMarketplaceSale(
        uint256 tokenId,
        uint256 salePrice,
        bool fromPoolInventory
    ) external payable nonReentrant {
        _onlyListingVenue();
        if (!pendingExternalSale[tokenId] || pendingExternalSaleFromPool[tokenId] != fromPoolInventory) {
            revert ExternalListingNotTracked();
        }
        if (msg.value == 0) revert InvalidAmount();

        delete pendingExternalSale[tokenId];
        delete pendingExternalSaleFromPool[tokenId];

        if (fromPoolInventory) {
            if (totalSoldIntoPool > 0) totalSoldIntoPool -= 1;
            ethBalance += msg.value;
        } else {
            treasuryBalance += msg.value;
        }

        _updateFloorEma();
        _refreshMarketState();
        emit ExternalSaleConfirmed(tokenId, salePrice, fromPoolInventory);
    }

    function returnProtocolListing(uint256 tokenId, bool fromPoolInventory) external nonReentrant {
        _onlyListingVenue();
        if (!pendingExternalSale[tokenId] || pendingExternalSaleFromPool[tokenId] != fromPoolInventory) {
            revert ExternalListingNotTracked();
        }

        delete pendingExternalSale[tokenId];
        delete pendingExternalSaleFromPool[tokenId];

        if (fromPoolInventory) {
            _addPool(tokenId);
        } else {
            _addVault(tokenId);
        }

        _updateFloorEma();
        _refreshMarketState();
        emit ProtocolListingReturned(tokenId, fromPoolInventory);
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
    function setListingVault(address vault) external onlyOwner {
        if (vault == address(0)) revert ZeroAddress();
        if (vault.code.length == 0) revert InvalidDependency();
        try IListingVenueSignals(vault).getMarketSnapshot() returns (
            uint256,
            uint256,
            uint256
        ) {} catch {
            revert InvalidDependency();
        }
        try IListingVenueSignals(vault).paused() returns (bool) {} catch {
            revert InvalidDependency();
        }
        emit ListingVaultUpdated(listingVault, vault);
        listingVault = vault;
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
            (uint256 purchaseRateBps, uint256 listingPressureBps, uint256 floorRatioBps,) = getMarketSignals();
            if (_isExpansionSignal(purchaseRateBps, listingPressureBps, floorRatioBps)) {
                next = MarketState.Expansion;
            } else if (_weakSignalCount(purchaseRateBps, listingPressureBps, floorRatioBps) >= 2) {
                next = MarketState.WeakDemand;
            } else {
                next = MarketState.Stabilization;
            }
        }

        marketState = next;
        if (previous != next) {
            (uint256 purchaseRateBps2, uint256 listingPressureBps2, uint256 floorRatioBps2,) = getMarketSignals();
            emit MarketStateUpdated(previous, next, purchaseRateBps2, listingPressureBps2, floorRatioBps2);
        }
    }

    function _applySpread(uint256 floor) private pure returns (uint256) {
        return floor + ((floor * STABILIZATION_SPREAD_BPS) / BPS);
    }

    function _isExpansionSignal(
        uint256 purchaseRateBps,
        uint256 listingPressureBps,
        uint256 floorRatioBps
    ) private pure returns (bool) {
        return
            purchaseRateBps >= EXPANSION_PURCHASE_RATE_BPS &&
            listingPressureBps <= EXPANSION_LISTING_PRESSURE_BPS &&
            floorRatioBps >= EXPANSION_FLOOR_RATIO_BPS;
    }

    function _isReleaseSignal(
        uint256 purchaseRateBps,
        uint256 listingPressureBps,
        uint256 floorRatioBps
    ) private pure returns (bool) {
        return
            purchaseRateBps >= RELEASE_PURCHASE_RATE_BPS &&
            listingPressureBps <= RELEASE_LISTING_PRESSURE_BPS &&
            floorRatioBps >= RELEASE_FLOOR_RATIO_BPS;
    }

    function _weakSignalCount(
        uint256 purchaseRateBps,
        uint256 listingPressureBps,
        uint256 floorRatioBps
    ) private pure returns (uint256 count) {
        if (purchaseRateBps < WEAK_DEMAND_PURCHASE_RATE_BPS) count += 1;
        if (listingPressureBps > WEAK_DEMAND_LISTING_PRESSURE_BPS) count += 1;
        if (floorRatioBps < WEAK_DEMAND_FLOOR_RATIO_BPS) count += 1;
    }

    function _coverageRatio(uint256 floor) private view returns (uint256) {
        if (floor == 0) return type(uint256).max;
        uint256 target = floor * TARGET_EXIT_BUFFER;
        if (target == 0) return type(uint256).max;
        return (ethBalance * BPS) / target;
    }

    function _referenceSupply() private view returns (uint256) {
        uint256 mintedLive = totalMinted > totalBurned ? totalMinted - totalBurned : 0;
        if (mintedLive > 0) return mintedLive;
        return nftContract.totalSupply();
    }

    function _manualSnapshotActive() private view returns (bool) {
        return
            _manualSnapshotModeActive() &&
            externalSnapshotAt != 0 &&
            block.timestamp <= externalSnapshotAt + MANUAL_SNAPSHOT_TTL;
    }

    function _manualSnapshotModeActive() private view returns (bool) {
        return manualSnapshotExpiresAt != 0 && block.timestamp <= manualSnapshotExpiresAt;
    }

    function _manualSnapshotVenueReady() private view returns (bool) {
        if (listingVault == address(0)) return false;
        if (listingVault.code.length == 0) return false;
        try IListingVenueSignals(listingVault).paused() returns (bool isPaused) {
            return isPaused;
        } catch {
            return false;
        }
    }

    function _trackExternalListing(uint256 tokenId, bool fromPoolInventory) private {
        pendingExternalSale[tokenId] = true;
        pendingExternalSaleFromPool[tokenId] = fromPoolInventory;
    }

    function onERC721Received(address,address,uint256,bytes calldata) external pure override returns(bytes4) { return IERC721Receiver.onERC721Received.selector; }
    receive() external payable {}
}
