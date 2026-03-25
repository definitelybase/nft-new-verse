// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @notice Minimal interface for OnChainPixelNFT mint function
interface IPixelNFT {
    function mint(bytes calldata pixelData) external payable;
    function mintCustom(bytes calldata pixelData, uint8 width, uint8 height) external payable;
    function mintTo(address to, bytes calldata pixelData) external;
    function mintToCustom(address to, bytes calldata pixelData, uint8 width, uint8 height) external;
    function totalSupply() external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function approve(address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice Minimal interface for PixelPool
interface IPixelPool {
    function seedLiquidity() external payable;
    function seedTreasury() external payable;
    function setTotalMinted(uint256 count) external;
    function sell(uint256 tokenId, uint256 minPrice) external;
    function buy(uint256 maxPrice) external payable returns (uint256 tokenId);
    function buySpecific(uint256 tokenId, uint256 maxPrice) external payable;
    function getFloorPrice() external view returns (uint256);
    function getSellPrice() external view returns (uint256);
    function getBuyPrice() external view returns (uint256);
    function availableNFTs() external view returns (uint256);
    function canSellIntoPool() external view returns (bool);
    function canBuyFromPool() external view returns (bool);
    function getMarketSignals() external view returns (
        uint256 volumeRatioBps,
        uint256 pressureRatioBps,
        uint256 floorDeviationBps,
        uint256 coverageRatioBps
    );
}

/// @title PixelRouter
/// @notice Single entry point for minting, seeding liquidity, and routing swaps
/// @dev Pool availability is controlled by PixelPool market-state rules
contract PixelRouter is Ownable, ReentrancyGuard {

    // ============================================================
    //                        ERRORS
    // ============================================================

    error IncorrectPayment();
    error TransferFailed();
    error MintFailed();
    error InvalidAmount();
    error InvalidBps();
    error InvalidDependency();
    error ZeroAddress();

    // ============================================================
    //                        EVENTS
    // ============================================================

    event Minted(address indexed minter, uint256 indexed tokenId, uint256 mintPrice, uint256 poolSeed);
    event Swapped(address indexed user, bool isBuy, uint256 indexed tokenId, uint256 price);
    event MintPriceUpdated(uint256 previousPrice, uint256 newPrice);
    event CreatorUpdated(address indexed previousCreator, address indexed newCreator);
    event PoolSeedBpsUpdated(uint256 previousBps, uint256 newBps);
    event TreasuryBpsUpdated(uint256 previousBps, uint256 newBps);
    event NFTRescued(uint256 indexed tokenId, address indexed to);
    event ETHRescued(address indexed to, uint256 amount);

    // ============================================================
    //                       STORAGE
    // ============================================================

    /// @notice The NFT contract
    IPixelNFT public immutable nftContract;

    /// @notice The liquidity pool
    IPixelPool public immutable pool;

    /// @notice Creator address (receives 30% of mint revenue)
    address public creator;

    /// @notice Mint price in wei
    uint256 public mintPrice;

    /// @notice Pool seed percentage (in BPS, 6000 = 60%)
    uint256 public poolSeedBps;

    /// @notice Treasury seed percentage (in BPS, 1000 = 10%)
    uint256 public treasuryBps;

    /// @notice Total ETH seeded to pool from mints
    uint256 public totalSeeded;

    // ============================================================
    //                     CONSTRUCTOR
    // ============================================================

    constructor(
        address nftContract_,
        address pool_,
        address creator_,
        uint256 mintPrice_,
        uint256 poolSeedBps_,
        uint256 treasuryBps_
    ) Ownable() {
        if (nftContract_ == address(0) || pool_ == address(0) || creator_ == address(0)) {
            revert ZeroAddress();
        }
        if (nftContract_.code.length == 0 || pool_.code.length == 0) revert InvalidDependency();
        if (mintPrice_ == 0) revert InvalidAmount();
        if (poolSeedBps_ + treasuryBps_ > 10000) revert InvalidBps();
        nftContract = IPixelNFT(nftContract_);
        pool = IPixelPool(pool_);
        creator = creator_;
        mintPrice = mintPrice_;
        poolSeedBps = poolSeedBps_;
        treasuryBps = treasuryBps_;
    }

    // ============================================================
    //                    MINT + AUTO SEED
    // ============================================================

    /// @notice Mint an NFT. Split: 60% pool, 10% treasury, 30% creator.
    /// @param pixelData Packed pixel indices
    function mint(bytes calldata pixelData) external payable nonReentrant {
        if (msg.value != mintPrice) revert IncorrectPayment();

        // Calculate 3-way split
        uint256 poolShare = (msg.value * poolSeedBps) / 10000;
        uint256 treasuryShare = (msg.value * treasuryBps) / 10000;
        uint256 creatorShare = msg.value - poolShare - treasuryShare;

        // Get next token ID
        uint256 tokenId = nftContract.totalSupply();

        // Mint NFT directly to user
        nftContract.mintTo(msg.sender, pixelData);

        // Seed pool (60%)
        pool.seedLiquidity{value: poolShare}();
        totalSeeded += poolShare;

        // Seed treasury (10%)
        pool.seedTreasury{value: treasuryShare}();

        // Update totalMinted
        pool.setTotalMinted(tokenId + 1);

        // Send creator share (30%)
        (bool success, ) = creator.call{value: creatorShare}("");
        if (!success) revert TransferFailed();

        emit Minted(msg.sender, tokenId, msg.value, poolShare);
    }

    /// @notice Mint with custom canvas size
    function mintCustom(bytes calldata pixelData, uint8 width, uint8 height)
        external payable nonReentrant
    {
        if (msg.value != mintPrice) revert IncorrectPayment();

        uint256 poolShare = (msg.value * poolSeedBps) / 10000;
        uint256 treasuryShare = (msg.value * treasuryBps) / 10000;
        uint256 creatorShare = msg.value - poolShare - treasuryShare;

        uint256 tokenId = nftContract.totalSupply();
        nftContract.mintToCustom(msg.sender, pixelData, width, height);

        pool.seedLiquidity{value: poolShare}();
        totalSeeded += poolShare;
        pool.seedTreasury{value: treasuryShare}();
        pool.setTotalMinted(tokenId + 1);

        (bool success, ) = creator.call{value: creatorShare}("");
        if (!success) revert TransferFailed();

        emit Minted(msg.sender, tokenId, msg.value, poolShare);
    }

    // ============================================================
    //                    SWAP: SELL NFT → ETH
    // ============================================================

    /// @notice Sell your NFT into the pool when pool buying is currently enabled
    /// @param tokenId The NFT to sell
    /// @param minPrice Minimum acceptable price (slippage protection)
    function sellNFT(uint256 tokenId, uint256 minPrice) external nonReentrant {
        // Router acts as a convenience layer around the pool's ownership checks.
        // The user must approve this router before the transfer can happen.
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        nftContract.approve(address(pool), tokenId);
        
        uint256 balanceBefore = address(this).balance;
        pool.sell(tokenId, minPrice);
        uint256 received = address(this).balance - balanceBefore;

        // Forward ETH to seller
        (bool success, ) = msg.sender.call{value: received}("");
        if (!success) revert TransferFailed();

        emit Swapped(msg.sender, false, tokenId, received);
    }

    // ============================================================
    //                    SWAP: ETH → BUY NFT
    // ============================================================

    /// @notice Buy an NFT from the pool when inventory sales are currently enabled
    /// @param maxPrice Maximum acceptable price (slippage protection)
    function buyNFT(uint256 maxPrice) external payable nonReentrant returns (uint256 tokenId) {
        uint256 balanceBefore = address(this).balance - msg.value;
        tokenId = pool.buy{value: msg.value}(maxPrice);
        uint256 refund = address(this).balance - balanceBefore;

        // Transfer NFT from pool (which sent it to router) to buyer
        nftContract.transferFrom(address(this), msg.sender, tokenId);

        if (refund > 0) {
            (bool success, ) = msg.sender.call{value: refund}("");
            if (!success) revert TransferFailed();
        }

        emit Swapped(msg.sender, true, tokenId, msg.value - refund);
    }

    /// @notice Buy a specific NFT from the pool inventory
    function buySpecificNFT(uint256 tokenId, uint256 maxPrice) external payable nonReentrant {
        uint256 balanceBefore = address(this).balance - msg.value;
        pool.buySpecific{value: msg.value}(tokenId, maxPrice);
        uint256 refund = address(this).balance - balanceBefore;
        nftContract.transferFrom(address(this), msg.sender, tokenId);

        if (refund > 0) {
            (bool success, ) = msg.sender.call{value: refund}("");
            if (!success) revert TransferFailed();
        }

        emit Swapped(msg.sender, true, tokenId, msg.value - refund);
    }

    // ============================================================
    //                    VIEW HELPERS
    // ============================================================

    /// @notice Get current prices
    function getPrices() external view returns (
        uint256 floorPrice,
        uint256 sellPrice,
        uint256 buyPrice,
        uint256 available
    ) {
        floorPrice = pool.getFloorPrice();
        sellPrice = pool.getSellPrice();
        buyPrice = pool.getBuyPrice();
        available = pool.availableNFTs();
    }

    /// @notice Surface pool availability and market signals for the UI
    function getPoolState() external view returns (
        bool poolBuysEnabled,
        bool poolSellsEnabled,
        uint256 volumeRatioBps,
        uint256 pressureRatioBps,
        uint256 floorDeviationBps,
        uint256 coverageRatioBps
    ) {
        poolBuysEnabled = pool.canSellIntoPool();
        poolSellsEnabled = pool.canBuyFromPool();
        (volumeRatioBps, pressureRatioBps, floorDeviationBps, coverageRatioBps) = pool.getMarketSignals();
    }

    // ============================================================
    //                      ADMIN
    // ============================================================

    /// @notice Update mint price
    function setMintPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidAmount();
        emit MintPriceUpdated(mintPrice, newPrice);
        mintPrice = newPrice;
    }

    /// @notice Update creator address
    function setCreator(address newCreator) external onlyOwner {
        if (newCreator == address(0)) revert ZeroAddress();
        emit CreatorUpdated(creator, newCreator);
        creator = newCreator;
    }

    /// @notice Update pool seed percentage
    function setPoolSeedBps(uint256 newBps) external onlyOwner {
        if (newBps + treasuryBps > 10000) revert InvalidBps();
        emit PoolSeedBpsUpdated(poolSeedBps, newBps);
        poolSeedBps = newBps;
    }

    /// @notice Update treasury seed percentage
    function setTreasuryBps(uint256 newBps) external onlyOwner {
        if (poolSeedBps + newBps > 10000) revert InvalidBps();
        emit TreasuryBpsUpdated(treasuryBps, newBps);
        treasuryBps = newBps;
    }

    /// @notice Rescue an NFT stuck in the router (e.g. from a failed sell flow)
    function rescueNFT(uint256 tokenId, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        nftContract.transferFrom(address(this), to, tokenId);
        emit NFTRescued(tokenId, to);
    }

    /// @notice Rescue ETH stuck in the router
    function rescueETH(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        if (bal == 0) revert TransferFailed();
        (bool success, ) = to.call{value: bal}("");
        if (!success) revert TransferFailed();
        emit ETHRescued(to, bal);
    }

    // ============================================================
    //                    RECEIVE ETH
    // ============================================================

    receive() external payable {}
}
