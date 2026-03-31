// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IPixelPoolMarket {
    function recordMarketplaceFee() external payable;
    function settleMarketplaceSale(uint256 tokenId, uint256 salePrice, bool fromPoolInventory) external payable;
    function returnProtocolListing(uint256 tokenId, bool fromPoolInventory) external;
}

/// @title PixelMarketplace
/// @notice Native marketplace with listings, offers, expiration, and activity history.
contract PixelMarketplace is IERC721Receiver, Ownable, ReentrancyGuard, Pausable {
    // ════════════════════════════════════════════
    //  ERRORS
    // ════════════════════════════════════════════

    error InvalidAmount();
    error InvalidDependency();
    error ZeroAddress();
    error ListingNotActive();
    error ListingExpired();
    error TokenAlreadyListed();
    error NotListingSeller();
    error NotProtocolAdmin();
    error NotTokenOwner();
    error IncorrectPayment();
    error TransferFailed();
    error UnknownProtocolTransfer();
    error OfferNotActive();
    error NotOfferMaker();
    error OfferExpired();
    error InvalidDuration();
    error CannotOfferOwnToken();

    // ════════════════════════════════════════════
    //  EVENTS
    // ════════════════════════════════════════════

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price,
        bool protocolOwned,
        bool fromPoolInventory,
        uint64 expiresAt
    );
    event ListingPriceUpdated(uint256 indexed listingId, uint256 previousPrice, uint256 newPrice);
    event ListingCancelled(uint256 indexed listingId, uint256 indexed tokenId, bool protocolOwned);
    event ListingPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 price,
        uint256 fee,
        bool protocolOwned,
        bool fromPoolInventory
    );

    event OfferCreated(
        uint256 indexed offerId,
        address indexed maker,
        uint256 indexed tokenId,
        uint256 amount,
        uint64 expiresAt,
        bool isCollectionOffer
    );
    event OfferAccepted(
        uint256 indexed offerId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 fee
    );
    event OfferCancelled(uint256 indexed offerId);

    event ActivityRecorded(
        uint256 indexed activityId,
        uint8 indexed activityType,
        uint256 indexed tokenId,
        address from,
        address to,
        uint256 price,
        uint64 timestamp
    );

    // ════════════════════════════════════════════
    //  CONSTANTS
    // ════════════════════════════════════════════

    uint256 private constant BPS = 10000;
    uint256 private constant SALE_WINDOW = 1 days;
    uint256 public constant MIN_LISTING_DURATION = 1 hours;
    uint256 public constant MAX_LISTING_DURATION = 180 days;
    uint256 public constant MIN_OFFER_DURATION = 10 minutes;
    uint256 public constant MAX_OFFER_DURATION = 90 days;
    uint256 public constant COLLECTION_OFFER_TOKEN_ID = type(uint256).max;

    // Activity types
    uint8 public constant ACT_LISTING_CREATED = 1;
    uint8 public constant ACT_LISTING_CANCELLED = 2;
    uint8 public constant ACT_SALE = 3;
    uint8 public constant ACT_OFFER_CREATED = 4;
    uint8 public constant ACT_OFFER_ACCEPTED = 5;
    uint8 public constant ACT_OFFER_CANCELLED = 6;

    // ════════════════════════════════════════════
    //  STRUCTS
    // ════════════════════════════════════════════

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool protocolOwned;
        bool fromPoolInventory;
        bool active;
        uint64 createdAt;
        uint64 expiresAt;
    }

    struct Offer {
        address maker;
        uint256 tokenId;       // COLLECTION_OFFER_TOKEN_ID for collection offers
        uint256 amount;
        bool active;
        uint64 createdAt;
        uint64 expiresAt;
    }

    struct Activity {
        uint8 activityType;
        uint256 tokenId;
        address from;
        address to;
        uint256 price;
        uint64 timestamp;
    }

    // ════════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════════

    IERC721 public immutable nftContract;
    IPixelPoolMarket public immutable pool;
    uint256 public immutable marketFeeBps;

    // Listings
    uint256 public nextListingId = 1;
    uint256 public activeListings;
    uint256 public currentFloor;
    uint256 public floorListingId;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) public listingIdByToken;
    uint256[] private _activeListingIds;
    mapping(uint256 => uint256) private _activeListingIdx;

    // Offers
    uint256 public nextOfferId = 1;
    uint256 public activeOfferCount;
    mapping(uint256 => Offer) public offers;
    // tokenId => offerId[] for quick lookup
    mapping(uint256 => uint256[]) private _tokenOfferIds;
    // collection offers stored under COLLECTION_OFFER_TOKEN_ID

    // Activity log
    uint256 public nextActivityId;
    mapping(uint256 => Activity) public activities;

    // Sales tracking
    uint256[] private _saleTimestamps;
    uint256 private _salesCursor;

    // ════════════════════════════════════════════
    //  CONSTRUCTOR
    // ════════════════════════════════════════════

    constructor(address nft_, address pool_, uint256 marketFeeBps_) Ownable() {
        if (nft_ == address(0) || pool_ == address(0)) revert ZeroAddress();
        if (nft_.code.length == 0 || pool_.code.length == 0) revert InvalidDependency();
        if (marketFeeBps_ > BPS) revert InvalidAmount();
        nftContract = IERC721(nft_);
        pool = IPixelPoolMarket(pool_);
        marketFeeBps = marketFeeBps_;
    }

    // ════════════════════════════════════════════
    //  LISTINGS
    // ════════════════════════════════════════════

    /// @notice Create a fixed-price listing with expiration
    /// @param tokenId The NFT to list
    /// @param price Listing price in wei
    /// @param duration Listing duration in seconds (MIN_LISTING_DURATION..MAX_LISTING_DURATION), 0 = max duration
    function createListing(uint256 tokenId, uint256 price, uint256 duration) external nonReentrant whenNotPaused returns (uint256 listingId) {
        if (price == 0) revert InvalidAmount();
        if (listingIdByToken[tokenId] != 0) revert TokenAlreadyListed();
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        uint64 expiresAt = _resolveExpiry(duration, MIN_LISTING_DURATION, MAX_LISTING_DURATION);

        nftContract.transferFrom(msg.sender, address(this), tokenId);
        listingId = _createListing(msg.sender, tokenId, price, false, false, expiresAt);

        _recordActivity(ACT_LISTING_CREATED, tokenId, msg.sender, address(0), price);
    }


    function updateListingPrice(uint256 listingId, uint256 newPrice) external whenNotPaused {
        if (newPrice == 0) revert InvalidAmount();
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.expiresAt != 0 && block.timestamp > listing.expiresAt) revert ListingExpired();

        if (listing.protocolOwned) {
            if (msg.sender != owner()) revert NotProtocolAdmin();
        } else if (listing.seller != msg.sender) {
            revert NotListingSeller();
        }

        uint256 previousPrice = listing.price;
        listing.price = newPrice;
        if (listingId == floorListingId) {
            if (newPrice > previousPrice) {
                _recomputeFloor();
            } else {
                currentFloor = newPrice;
            }
        } else if (currentFloor == 0 || newPrice < currentFloor) {
            currentFloor = newPrice;
            floorListingId = listingId;
        }

        emit ListingPriceUpdated(listingId, previousPrice, newPrice);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing memory listing = _takeListing(listingId);

        if (listing.protocolOwned) {
            if (msg.sender != owner()) revert NotProtocolAdmin();
            nftContract.safeTransferFrom(address(this), address(pool), listing.tokenId);
            pool.returnProtocolListing(listing.tokenId, listing.fromPoolInventory);
        } else {
            if (listing.seller != msg.sender) revert NotListingSeller();
            nftContract.safeTransferFrom(address(this), listing.seller, listing.tokenId);
        }

        _recordActivity(ACT_LISTING_CANCELLED, listing.tokenId, listing.seller, address(0), listing.price);
        emit ListingCancelled(listingId, listing.tokenId, listing.protocolOwned);
    }

    function buyListing(uint256 listingId) external payable nonReentrant whenNotPaused {
        Listing memory listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.expiresAt != 0 && block.timestamp > listing.expiresAt) revert ListingExpired();

        _takeListing(listingId);

        if (msg.value < listing.price) revert IncorrectPayment();

        uint256 fee = (listing.price * marketFeeBps) / BPS;
        uint256 proceeds = listing.price - fee;

        _recordSale();

        if (fee > 0) {
            pool.recordMarketplaceFee{value: fee}();
        }

        if (listing.protocolOwned) {
            pool.settleMarketplaceSale{value: proceeds}(listing.tokenId, listing.price, listing.fromPoolInventory);
        } else {
            (bool sentSeller,) = listing.seller.call{value: proceeds}("");
            if (!sentSeller) revert TransferFailed();
        }

        nftContract.safeTransferFrom(address(this), msg.sender, listing.tokenId);

        if (msg.value > listing.price) {
            (bool refunded,) = msg.sender.call{value: msg.value - listing.price}("");
            if (!refunded) revert TransferFailed();
        }

        _recordActivity(ACT_SALE, listing.tokenId, listing.seller, msg.sender, listing.price);
        emit ListingPurchased(
            listingId,
            msg.sender,
            listing.tokenId,
            listing.price,
            fee,
            listing.protocolOwned,
            listing.fromPoolInventory
        );
    }

    // ════════════════════════════════════════════
    //  OFFERS
    // ════════════════════════════════════════════

    /// @notice Make an offer on a specific NFT. ETH is escrowed.
    /// @param tokenId The NFT to bid on
    /// @param duration Offer duration in seconds (MIN_OFFER_DURATION..MAX_OFFER_DURATION), 0 = max
    function makeOffer(uint256 tokenId, uint256 duration) external payable nonReentrant returns (uint256 offerId) {
        if (msg.value == 0) revert InvalidAmount();
        // Prevent offering on your own token (only if it exists and you own it)
        try nftContract.ownerOf(tokenId) returns (address tokenOwner) {
            if (tokenOwner == msg.sender) revert CannotOfferOwnToken();
        } catch {
            // Token may not exist yet — allow the offer
        }

        uint64 expiresAt = _resolveExpiry(duration, MIN_OFFER_DURATION, MAX_OFFER_DURATION);

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            maker: msg.sender,
            tokenId: tokenId,
            amount: msg.value,
            active: true,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt
        });
        _tokenOfferIds[tokenId].push(offerId);
        activeOfferCount++;

        _recordActivity(ACT_OFFER_CREATED, tokenId, msg.sender, address(0), msg.value);
        emit OfferCreated(offerId, msg.sender, tokenId, msg.value, expiresAt, false);
    }

    /// @notice Make a collection-wide offer — any holder can accept with any token.
    /// @param duration Offer duration in seconds
    function makeCollectionOffer(uint256 duration) external payable nonReentrant returns (uint256 offerId) {
        if (msg.value == 0) revert InvalidAmount();

        uint64 expiresAt = _resolveExpiry(duration, MIN_OFFER_DURATION, MAX_OFFER_DURATION);

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            maker: msg.sender,
            tokenId: COLLECTION_OFFER_TOKEN_ID,
            amount: msg.value,
            active: true,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt
        });
        _tokenOfferIds[COLLECTION_OFFER_TOKEN_ID].push(offerId);
        activeOfferCount++;

        _recordActivity(ACT_OFFER_CREATED, COLLECTION_OFFER_TOKEN_ID, msg.sender, address(0), msg.value);
        emit OfferCreated(offerId, msg.sender, COLLECTION_OFFER_TOKEN_ID, msg.value, expiresAt, true);
    }

    /// @notice Accept an offer. Caller must own the NFT (or the specific token for token offers).
    /// @param offerId The offer to accept
    /// @param tokenId The token to sell (matters for collection offers; must match for token offers)
    function acceptOffer(uint256 offerId, uint256 tokenId) external nonReentrant {
        Offer memory offer = offers[offerId];
        if (!offer.active) revert OfferNotActive();
        if (offer.expiresAt != 0 && block.timestamp > offer.expiresAt) revert OfferExpired();

        // Validate token match
        if (offer.tokenId != COLLECTION_OFFER_TOKEN_ID) {
            if (offer.tokenId != tokenId) revert InvalidAmount();
        }

        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        // Deactivate offer
        offers[offerId].active = false;
        activeOfferCount--;

        // Calculate fees
        uint256 fee = (offer.amount * marketFeeBps) / BPS;
        uint256 proceeds = offer.amount - fee;

        _recordSale();

        // Transfer NFT from seller to offer maker
        nftContract.transferFrom(msg.sender, offer.maker, tokenId);

        // Pay fee to pool
        if (fee > 0) {
            pool.recordMarketplaceFee{value: fee}();
        }

        // Pay seller
        (bool sent,) = msg.sender.call{value: proceeds}("");
        if (!sent) revert TransferFailed();

        // If this token had an active listing, clean it up
        uint256 existingListingId = listingIdByToken[tokenId];
        if (existingListingId != 0 && listings[existingListingId].active) {
            // Return NFT is not needed since seller already transferred it
            // Just clean up listing state
            _takeListing(existingListingId);
        }

        _recordActivity(ACT_OFFER_ACCEPTED, tokenId, offer.maker, msg.sender, offer.amount);
        emit OfferAccepted(offerId, msg.sender, tokenId, offer.amount, fee);
    }

    /// @notice Cancel your offer and reclaim escrowed ETH.
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offers[offerId];
        if (!offer.active) revert OfferNotActive();
        if (offer.maker != msg.sender) revert NotOfferMaker();

        offers[offerId].active = false;
        activeOfferCount--;

        (bool sent,) = msg.sender.call{value: offer.amount}("");
        if (!sent) revert TransferFailed();

        uint256 tokenId = offer.tokenId;
        _recordActivity(ACT_OFFER_CANCELLED, tokenId, msg.sender, address(0), offer.amount);
        emit OfferCancelled(offerId);
    }

    /// @notice Reclaim ETH from an expired offer (anyone can call for gas refund fairness).
    function reclaimExpiredOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offers[offerId];
        if (!offer.active) revert OfferNotActive();
        if (offer.expiresAt == 0 || block.timestamp <= offer.expiresAt) revert OfferNotActive();

        offers[offerId].active = false;
        activeOfferCount--;

        (bool sent,) = offer.maker.call{value: offer.amount}("");
        if (!sent) revert TransferFailed();

        emit OfferCancelled(offerId);
    }

    // ════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ════════════════════════════════════════════

    function getMarketSnapshot() external view returns (uint256 sales24h, uint256 listedCount, uint256 floorPrice) {
        return (_salesLast24h(), activeListings, currentFloor);
    }

    function getActiveListingIds() external view returns (uint256[] memory) {
        return _activeListingIds;
    }

    /// @notice Get all offer IDs for a specific token (includes inactive — filter off-chain).
    function getTokenOfferIds(uint256 tokenId) external view returns (uint256[] memory) {
        return _tokenOfferIds[tokenId];
    }

    /// @notice Get all collection offer IDs.
    function getCollectionOfferIds() external view returns (uint256[] memory) {
        return _tokenOfferIds[COLLECTION_OFFER_TOKEN_ID];
    }

    /// @notice Get the best (highest) active offer for a token.
    function getBestOffer(uint256 tokenId) external view returns (uint256 bestOfferId, uint256 bestAmount) {
        uint256[] storage offerIds = _tokenOfferIds[tokenId];
        for (uint256 i = 0; i < offerIds.length; i++) {
            Offer storage o = offers[offerIds[i]];
            if (o.active && (o.expiresAt == 0 || block.timestamp <= o.expiresAt) && o.amount > bestAmount) {
                bestAmount = o.amount;
                bestOfferId = offerIds[i];
            }
        }
        // Also check collection offers
        uint256[] storage collOfferIds = _tokenOfferIds[COLLECTION_OFFER_TOKEN_ID];
        for (uint256 i = 0; i < collOfferIds.length; i++) {
            Offer storage o = offers[collOfferIds[i]];
            if (o.active && (o.expiresAt == 0 || block.timestamp <= o.expiresAt) && o.amount > bestAmount) {
                bestAmount = o.amount;
                bestOfferId = collOfferIds[i];
            }
        }
    }

    /// @notice Get recent activity entries. Returns up to `count` entries ending at `beforeId`.
    /// @param beforeId Start scanning backwards from this ID (use nextActivityId for latest)
    /// @param count Max entries to return
    function getRecentActivity(uint256 beforeId, uint256 count) external view returns (Activity[] memory result) {
        if (beforeId > nextActivityId) beforeId = nextActivityId;
        if (count > beforeId) count = beforeId;

        result = new Activity[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activities[beforeId - 1 - i];
        }
    }

    /// @notice Get activity entries for a specific token.
    /// @dev Linear scan — use off-chain indexing for large histories.
    function getTokenActivity(uint256 tokenId, uint256 maxResults) external view returns (Activity[] memory result) {
        Activity[] memory temp = new Activity[](maxResults);
        uint256 found;
        for (uint256 i = nextActivityId; i > 0 && found < maxResults; i--) {
            if (activities[i - 1].tokenId == tokenId) {
                temp[found++] = activities[i - 1];
            }
        }
        result = new Activity[](found);
        for (uint256 i = 0; i < found; i++) {
            result[i] = temp[i];
        }
    }

    // ════════════════════════════════════════════
    //  ERC721 RECEIVER (protocol listings)
    // ════════════════════════════════════════════

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override nonReentrant whenNotPaused returns (bytes4) {
        if (msg.sender != address(nftContract)) revert UnknownProtocolTransfer();
        if (from != address(pool) || operator != address(pool) || data.length == 0) {
            revert UnknownProtocolTransfer();
        }

        (uint256 price, bool fromPoolInventory) = abi.decode(data, (uint256, bool));
        if (price == 0) revert InvalidAmount();
        if (listingIdByToken[tokenId] != 0) revert TokenAlreadyListed();

        uint64 expiresAt = uint64(block.timestamp + MAX_LISTING_DURATION);
        _createListing(address(pool), tokenId, price, true, fromPoolInventory, expiresAt);
        return IERC721Receiver.onERC721Received.selector;
    }

    // ════════════════════════════════════════════
    //  INTERNAL — LISTINGS
    // ════════════════════════════════════════════

    function _createListing(
        address seller,
        uint256 tokenId,
        uint256 price,
        bool protocolOwned,
        bool fromPoolInventory,
        uint64 expiresAt
    ) private returns (uint256 listingId) {
        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: seller,
            tokenId: tokenId,
            price: price,
            protocolOwned: protocolOwned,
            fromPoolInventory: fromPoolInventory,
            active: true,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt
        });
        listingIdByToken[tokenId] = listingId;
        _activeListingIdx[listingId] = _activeListingIds.length;
        _activeListingIds.push(listingId);
        activeListings += 1;

        if (currentFloor == 0 || price < currentFloor) {
            currentFloor = price;
            floorListingId = listingId;
        }

        emit ListingCreated(listingId, seller, tokenId, price, protocolOwned, fromPoolInventory, expiresAt);
    }

    function _takeListing(uint256 listingId) private returns (Listing memory listing) {
        listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();

        uint256 tokenId = listing.tokenId;
        delete listingIdByToken[tokenId];
        delete listings[listingId];

        uint256 idx = _activeListingIdx[listingId];
        uint256 lastIdx = _activeListingIds.length - 1;
        if (idx != lastIdx) {
            uint256 moved = _activeListingIds[lastIdx];
            _activeListingIds[idx] = moved;
            _activeListingIdx[moved] = idx;
        }
        _activeListingIds.pop();
        delete _activeListingIdx[listingId];
        activeListings -= 1;

        if (listingId == floorListingId) {
            _recomputeFloor();
        }
    }

    function _recomputeFloor() private {
        uint256 bestPrice;
        uint256 bestListingId;
        uint256 length = _activeListingIds.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 lid = _activeListingIds[i];
            Listing storage l = listings[lid];
            // Skip expired listings in floor calc
            if (l.expiresAt != 0 && block.timestamp > l.expiresAt) continue;
            uint256 price = l.price;
            if (bestPrice == 0 || price < bestPrice) {
                bestPrice = price;
                bestListingId = lid;
            }
        }
        currentFloor = bestPrice;
        floorListingId = bestListingId;
    }

    // ════════════════════════════════════════════
    //  INTERNAL — SALES TRACKING
    // ════════════════════════════════════════════

    function _recordSale() private {
        _pruneSalesCursor();
        _saleTimestamps.push(block.timestamp);
    }

    function _pruneSalesCursor() private {
        uint256 length = _saleTimestamps.length;
        while (_salesCursor < length && _saleTimestamps[_salesCursor] + SALE_WINDOW < block.timestamp) {
            _salesCursor++;
        }
    }

    function _salesLast24h() private view returns (uint256) {
        uint256 cursor = _salesCursor;
        uint256 length = _saleTimestamps.length;
        while (cursor < length && _saleTimestamps[cursor] + SALE_WINDOW < block.timestamp) {
            cursor++;
        }
        return length - cursor;
    }

    // ════════════════════════════════════════════
    //  INTERNAL — ACTIVITY LOG
    // ════════════════════════════════════════════

    function _recordActivity(
        uint8 activityType,
        uint256 tokenId,
        address from,
        address to,
        uint256 price
    ) private {
        uint256 id = nextActivityId++;
        activities[id] = Activity({
            activityType: activityType,
            tokenId: tokenId,
            from: from,
            to: to,
            price: price,
            timestamp: uint64(block.timestamp)
        });
        emit ActivityRecorded(id, activityType, tokenId, from, to, price, uint64(block.timestamp));
    }

    // ════════════════════════════════════════════
    //  INTERNAL — HELPERS
    // ════════════════════════════════════════════

    function _resolveExpiry(uint256 duration, uint256 minDur, uint256 maxDur) private view returns (uint64) {
        if (duration == 0) return uint64(block.timestamp + maxDur);
        if (duration < minDur || duration > maxDur) revert InvalidDuration();
        return uint64(block.timestamp + duration);
    }
}
