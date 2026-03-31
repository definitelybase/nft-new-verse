// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal interface for wiring contracts after deployment
interface ISetup {
    function setMinter(address minter, bool authorized) external;
    function setBurner(address burner, bool authorized) external;
    function setRouter(address router_) external;
    function setListingVault(address vault) external;
    function transferOwnership(address newOwner) external;
}

interface ISetupNFT is ISetup {
    function lockPalette() external;
}

/// @title PixelFactory
/// @notice Deploy an entire OnChainPixel collection in one transaction
/// @dev Stores creation bytecodes separately via setCode(). 
///      createCollection() deploys NFT + Pool + Router via CREATE2,
///      wires permissions, and transfers ownership to the creator.
contract PixelFactory is Ownable {
    error InvalidAmount();
    error InsufficientFee();
    error InvalidBps();
    error MissingBytecode();
    error DeployFailed();
    error TransferFailed();
    error ZeroAddress();

    event CollectionCreated(
        address indexed creator,
        address nft,
        address pool,
        address router,
        address market
    );
    event NFTCodeUpdated(uint256 length);
    event PoolCodeUpdated(uint256 length);
    event RouterCodeUpdated(uint256 length);
    event MarketplaceCodeUpdated(uint256 length);
    event FactoryFeeUpdated(uint256 previousFee, uint256 newFee);
    event FactoryWithdrawn(address indexed to, uint256 amount);

    struct Collection {
        address pool;
        address router;
        address market;
        address creator;
        uint64 createdAt;
    }

    struct CreateParams {
        string name;
        string symbol;
        uint8 bitDepth;
        uint8 defaultWidth;
        uint8 defaultHeight;
        uint256 maxSupply;
        uint256 mintPrice;
        uint256 poolSeedBps;
        uint256 treasuryBps;
        bytes paletteRGB;
        address finalOwner;
        bool lockPalette;
    }

    address[] public collections;
    mapping(address => Collection) public collectionInfo;

    /// @notice Stored creation bytecodes (set once by owner)
    bytes public nftCode;
    bytes public poolCode;
    bytes public routerCode;
    bytes public marketCode;
    
    uint256 public factoryFee;
    uint256 private constant MARKET_FEE_BPS = 250;

    constructor() Ownable() {}

    // ============================================================
    //                   SET BYTECODES (once)
    // ============================================================

    function setNFTCode(bytes calldata code) external onlyOwner {
        if (code.length == 0) revert MissingBytecode();
        nftCode = code;
        emit NFTCodeUpdated(code.length);
    }
    function setPoolCode(bytes calldata code) external onlyOwner {
        if (code.length == 0) revert MissingBytecode();
        poolCode = code;
        emit PoolCodeUpdated(code.length);
    }
    function setRouterCode(bytes calldata code) external onlyOwner {
        if (code.length == 0) revert MissingBytecode();
        routerCode = code;
        emit RouterCodeUpdated(code.length);
    }
    function setMarketplaceCode(bytes calldata code) external onlyOwner {
        if (code.length == 0) revert MissingBytecode();
        marketCode = code;
        emit MarketplaceCodeUpdated(code.length);
    }

    // ============================================================
    //                  CREATE COLLECTION
    // ============================================================

    function createCollection(
        string calldata name_,
        string calldata symbol_,
        uint8 bitDepth_,
        uint8 defaultWidth_,
        uint8 defaultHeight_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 poolSeedBps_,
        uint256 treasuryBps_,
        bytes calldata paletteRGB
    ) external payable returns (address nftAddr, address poolAddr, address routerAddr, address marketAddr) {
        CreateParams memory params = CreateParams({
            name: name_,
            symbol: symbol_,
            bitDepth: bitDepth_,
            defaultWidth: defaultWidth_,
            defaultHeight: defaultHeight_,
            maxSupply: maxSupply_,
            mintPrice: mintPrice_,
            poolSeedBps: poolSeedBps_,
            treasuryBps: treasuryBps_,
            paletteRGB: paletteRGB,
            finalOwner: msg.sender,
            lockPalette: false
        });
        return _createCollection(params);
    }

    function createCollectionSafe(
        string calldata name_,
        string calldata symbol_,
        uint8 bitDepth_,
        uint8 defaultWidth_,
        uint8 defaultHeight_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 poolSeedBps_,
        uint256 treasuryBps_,
        bytes calldata paletteRGB,
        address finalOwner_,
        bool lockPalette_
    ) external payable returns (address nftAddr, address poolAddr, address routerAddr, address marketAddr) {
        CreateParams memory params = CreateParams({
            name: name_,
            symbol: symbol_,
            bitDepth: bitDepth_,
            defaultWidth: defaultWidth_,
            defaultHeight: defaultHeight_,
            maxSupply: maxSupply_,
            mintPrice: mintPrice_,
            poolSeedBps: poolSeedBps_,
            treasuryBps: treasuryBps_,
            paletteRGB: paletteRGB,
            finalOwner: finalOwner_,
            lockPalette: lockPalette_
        });
        return _createCollection(params);
    }

    function _createCollection(CreateParams memory params)
        private
        returns (address nftAddr, address poolAddr, address routerAddr, address marketAddr)
    {
        if (nftCode.length == 0 || poolCode.length == 0 || routerCode.length == 0 || marketCode.length == 0) {
            revert MissingBytecode();
        }
        if (params.maxSupply == 0 || params.mintPrice == 0) revert InvalidAmount();
        if (msg.value < factoryFee) revert InsufficientFee();
        if (params.poolSeedBps + params.treasuryBps > 10000) revert InvalidBps();
        if (params.finalOwner == address(0)) revert ZeroAddress();

        uint256 salt = uint256(keccak256(abi.encodePacked(msg.sender, collections.length)));

        // 1. Deploy NFT with the same mintPrice configuration as the router.
        // Public mint remains owner-gated at the NFT layer, but the price stays coherent.
        nftAddr = _deploy(abi.encodePacked(
            nftCode,
            abi.encode(
                params.name,
                params.symbol,
                params.bitDepth,
                params.defaultWidth,
                params.defaultHeight,
                params.maxSupply,
                params.mintPrice,
                params.paletteRGB
            )
        ), salt);

        // 2. Deploy Pool
        poolAddr = _deploy(abi.encodePacked(
            poolCode,
            abi.encode(nftAddr, params.mintPrice)
        ), salt + 1);

        // 3. Deploy Router
        routerAddr = _deploy(abi.encodePacked(
            routerCode,
            abi.encode(
                nftAddr,
                poolAddr,
                msg.sender,
                params.mintPrice,
                params.poolSeedBps,
                params.treasuryBps
            )
        ), salt + 2);

        // 4. Deploy Marketplace
        marketAddr = _deploy(abi.encodePacked(
            marketCode,
            abi.encode(nftAddr, poolAddr, MARKET_FEE_BPS)
        ), salt + 3);

        // 5. Wire permissions
        ISetupNFT(nftAddr).setMinter(routerAddr, true);
        ISetupNFT(nftAddr).setBurner(poolAddr, true);
        ISetup(poolAddr).setRouter(routerAddr);
        ISetup(poolAddr).setListingVault(marketAddr);
        if (params.lockPalette) {
            ISetupNFT(nftAddr).lockPalette();
        }

        // 6. Transfer ownership to final owner
        ISetupNFT(nftAddr).transferOwnership(params.finalOwner);
        ISetup(poolAddr).transferOwnership(params.finalOwner);
        ISetup(routerAddr).transferOwnership(params.finalOwner);
        ISetup(marketAddr).transferOwnership(params.finalOwner);

        // 7. Store
        collectionInfo[nftAddr] = Collection(poolAddr, routerAddr, marketAddr, msg.sender, uint64(block.timestamp));
        collections.push(nftAddr);

        emit CollectionCreated(msg.sender, nftAddr, poolAddr, routerAddr, marketAddr);
    }

    function _deploy(bytes memory bytecode, uint256 salt) private returns (address addr) {
        bytes32 s = bytes32(salt);
        assembly { addr := create2(0, add(bytecode, 0x20), mload(bytecode), s) }
        if (addr == address(0)) revert DeployFailed();
    }

    // ============================================================
    //                    VIEW
    // ============================================================

    function totalCollections() external view returns (uint256) { return collections.length; }

    function getCollection(uint256 i) external view returns (
        address nft, address pool, address router, address market, address creator, uint256 createdAt
    ) {
        nft = collections[i];
        Collection memory c = collectionInfo[nft];
        return (nft, c.pool, c.router, c.market, c.creator, uint256(c.createdAt));
    }

    // ============================================================
    //                    ADMIN
    // ============================================================

    function setFactoryFee(uint256 fee) external onlyOwner {
        emit FactoryFeeUpdated(factoryFee, fee);
        factoryFee = fee;
    }
    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool s, ) = msg.sender.call{value: amount}("");
        if (!s) revert TransferFailed();
        emit FactoryWithdrawn(msg.sender, amount);
    }
}
