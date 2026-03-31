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
/// @notice Native marketplace for user listings and protocol inventory listings.
/// @dev Protocol inventory is transferred in from PixelPool and auto-listed on receipt.
contract PixelMarketplace is IERC721Receiver, Ownable, ReentrancyGuard, Pausable {
    error InvalidAmount();
    error InvalidDependency();
    error ZeroAddress();
    error ListingNotActive();
    error TokenAlreadyListed();
    error NotListingSeller();
    error NotProtocolAdmin();
    error NotTokenOwner();
    error IncorrectPayment();
    error TransferFailed();
    error UnknownProtocolTransfer();

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price,
        bool protocolOwned,
        bool fromPoolInventory
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

    uint256 private constant BPS = 10000;
    uint256 private constant SALE_WINDOW = 1 days;
    uint256 private constant SALE_BUCKET_COUNT = 24;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool protocolOwned;
        bool fromPoolInventory;
        bool active;
        uint64 createdAt;
    }

    struct SaleBucket {
        uint64 windowStart;
        uint64 count;
    }

    IERC721 public immutable nftContract;
    IPixelPoolMarket public immutable pool;
    uint256 public immutable marketFeeBps;

    uint256 public nextListingId = 1;
    uint256 public activeListings;
    uint256 public currentFloor;
    uint256 public floorListingId;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) public listingIdByToken;
    uint256[] private _activeListingIds;
    mapping(uint256 => uint256) private _activeListingIdx;
    uint256[] private _floorHeap;
    mapping(uint256 => uint256) private _heapIndex;

    SaleBucket[SALE_BUCKET_COUNT] private _saleBuckets;

    constructor(address nft_, address pool_, uint256 marketFeeBps_) Ownable() {
        if (nft_ == address(0) || pool_ == address(0)) revert ZeroAddress();
        if (nft_.code.length == 0 || pool_.code.length == 0) revert InvalidDependency();
        if (marketFeeBps_ > BPS) revert InvalidAmount();
        nftContract = IERC721(nft_);
        pool = IPixelPoolMarket(pool_);
        marketFeeBps = marketFeeBps_;
    }

    function createListing(uint256 tokenId, uint256 price)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 listingId)
    {
        if (price == 0) revert InvalidAmount();
        if (listingIdByToken[tokenId] != 0) revert TokenAlreadyListed();
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        nftContract.transferFrom(msg.sender, address(this), tokenId);
        listingId = _createListing(msg.sender, tokenId, price, false, false);
    }

    function updateListingPrice(uint256 listingId, uint256 newPrice) external whenNotPaused {
        if (newPrice == 0) revert InvalidAmount();
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();

        if (listing.protocolOwned) {
            if (msg.sender != owner()) revert NotProtocolAdmin();
        } else if (listing.seller != msg.sender) {
            revert NotListingSeller();
        }

        uint256 previousPrice = listing.price;
        listing.price = newPrice;
        _heapRebalance(listingId);

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

        emit ListingCancelled(listingId, listing.tokenId, listing.protocolOwned);
    }

    function buyListing(uint256 listingId) external payable nonReentrant whenNotPaused {
        Listing memory listing = _takeListing(listingId);
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

    function getMarketSnapshot() external view returns (uint256 sales24h, uint256 listedCount, uint256 floorPrice) {
        return (_salesLast24h(), activeListings, currentFloor);
    }

    function getActiveListingIds() external view returns (uint256[] memory) {
        return _activeListingIds;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

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

        _createListing(address(pool), tokenId, price, true, fromPoolInventory);
        return IERC721Receiver.onERC721Received.selector;
    }

    function _createListing(
        address seller,
        uint256 tokenId,
        uint256 price,
        bool protocolOwned,
        bool fromPoolInventory
    ) private returns (uint256 listingId) {
        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: seller,
            tokenId: tokenId,
            price: price,
            protocolOwned: protocolOwned,
            fromPoolInventory: fromPoolInventory,
            active: true,
            createdAt: uint64(block.timestamp)
        });
        listingIdByToken[tokenId] = listingId;
        _activeListingIdx[listingId] = _activeListingIds.length;
        _activeListingIds.push(listingId);
        activeListings += 1;
        _heapInsert(listingId);

        emit ListingCreated(listingId, seller, tokenId, price, protocolOwned, fromPoolInventory);
    }

    function _takeListing(uint256 listingId) private returns (Listing memory listing) {
        listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        _heapRemove(listingId);

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
    }

    function _heapInsert(uint256 listingId) private {
        _floorHeap.push(listingId);
        _heapIndex[listingId] = _floorHeap.length;
        _heapSiftUp(_floorHeap.length - 1);
        _syncFloorFromHeap();
    }

    function _heapRemove(uint256 listingId) private {
        uint256 storedIndex = _heapIndex[listingId];
        if (storedIndex == 0) return;

        uint256 idx = storedIndex - 1;
        uint256 lastIdx = _floorHeap.length - 1;
        if (idx != lastIdx) {
            uint256 movedListingId = _floorHeap[lastIdx];
            _floorHeap[idx] = movedListingId;
            _heapIndex[movedListingId] = idx + 1;
        }

        _floorHeap.pop();
        delete _heapIndex[listingId];

        if (idx < _floorHeap.length) {
            _heapRebalanceAt(idx);
        } else {
            _syncFloorFromHeap();
        }
    }

    function _heapRebalance(uint256 listingId) private {
        uint256 storedIndex = _heapIndex[listingId];
        if (storedIndex == 0) return;
        _heapRebalanceAt(storedIndex - 1);
    }

    function _heapRebalanceAt(uint256 idx) private {
        if (idx > 0) {
            uint256 parentIdx = (idx - 1) / 2;
            if (_heapLess(_floorHeap[idx], _floorHeap[parentIdx])) {
                _heapSiftUp(idx);
                _syncFloorFromHeap();
                return;
            }
        }

        _heapSiftDown(idx);
        _syncFloorFromHeap();
    }

    function _heapSiftUp(uint256 idx) private {
        while (idx > 0) {
            uint256 parentIdx = (idx - 1) / 2;
            uint256 listingId = _floorHeap[idx];
            uint256 parentListingId = _floorHeap[parentIdx];
            if (!_heapLess(listingId, parentListingId)) break;
            _heapSwap(idx, parentIdx);
            idx = parentIdx;
        }
    }

    function _heapSiftDown(uint256 idx) private {
        uint256 length = _floorHeap.length;
        while (true) {
            uint256 left = (idx * 2) + 1;
            uint256 right = left + 1;
            uint256 smallest = idx;

            if (left < length && _heapLess(_floorHeap[left], _floorHeap[smallest])) {
                smallest = left;
            }
            if (right < length && _heapLess(_floorHeap[right], _floorHeap[smallest])) {
                smallest = right;
            }
            if (smallest == idx) break;

            _heapSwap(idx, smallest);
            idx = smallest;
        }
    }

    function _heapSwap(uint256 a, uint256 b) private {
        uint256 listingA = _floorHeap[a];
        uint256 listingB = _floorHeap[b];
        _floorHeap[a] = listingB;
        _floorHeap[b] = listingA;
        _heapIndex[listingA] = b + 1;
        _heapIndex[listingB] = a + 1;
    }

    function _heapLess(uint256 leftListingId, uint256 rightListingId) private view returns (bool) {
        uint256 leftPrice = listings[leftListingId].price;
        uint256 rightPrice = listings[rightListingId].price;
        if (leftPrice == rightPrice) return leftListingId < rightListingId;
        return leftPrice < rightPrice;
    }

    function _syncFloorFromHeap() private {
        if (_floorHeap.length == 0) {
            currentFloor = 0;
            floorListingId = 0;
            return;
        }

        uint256 rootListingId = _floorHeap[0];
        floorListingId = rootListingId;
        currentFloor = listings[rootListingId].price;
    }

    function _recordSale() private {
        uint64 bucketStart = uint64((block.timestamp / 1 hours) * 1 hours);
        uint256 bucketIndex = (block.timestamp / 1 hours) % SALE_BUCKET_COUNT;
        SaleBucket storage bucket = _saleBuckets[bucketIndex];
        if (bucket.windowStart != bucketStart) {
            bucket.windowStart = bucketStart;
            bucket.count = 0;
        }
        bucket.count += 1;
    }

    function _salesLast24h() private view returns (uint256 total) {
        for (uint256 i = 0; i < SALE_BUCKET_COUNT; i++) {
            SaleBucket storage bucket = _saleBuckets[i];
            if (bucket.windowStart == 0) continue;
            if (bucket.windowStart + SALE_WINDOW <= block.timestamp) continue;
            total += bucket.count;
        }
    }
}
