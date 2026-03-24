// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal interface for wiring contracts after deployment
interface ISetup {
    function setMinter(address minter, bool authorized) external;
    function setBurner(address burner, bool authorized) external;
    function setRouter(address router_) external;
    function transferOwnership(address newOwner) external;
}

/// @title PixelFactory
/// @notice Deploy an entire OnChainPixel collection in one transaction
/// @dev Stores creation bytecodes separately via setCode(). 
///      createCollection() deploys NFT + Pool + Router via CREATE2,
///      wires permissions, and transfers ownership to the creator.
contract PixelFactory is Ownable {
    error NotInitialized();
    error InsufficientFee();
    error InvalidBps();
    error MissingBytecode();

    event CollectionCreated(
        address indexed creator,
        address nft,
        address pool,
        address router,
        string name,
        string symbol
    );

    struct Collection {
        address nft;
        address pool;
        address router;
        address creator;
        uint256 createdAt;
    }

    address[] public collections;
    mapping(address => Collection) public collectionInfo;

    /// @notice Stored creation bytecodes (set once by owner)
    bytes public nftCode;
    bytes public poolCode;
    bytes public routerCode;
    
    uint256 public factoryFee;
    bool public initialized;

    constructor() Ownable() {}

    // ============================================================
    //                   SET BYTECODES (once)
    // ============================================================

    function setNFTCode(bytes calldata code) external onlyOwner { nftCode = code; }
    function setPoolCode(bytes calldata code) external onlyOwner { poolCode = code; }
    function setRouterCode(bytes calldata code) external onlyOwner { 
        routerCode = code; 
        initialized = true; 
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
    ) external payable returns (address nftAddr, address poolAddr, address routerAddr) {
        if (!initialized) revert NotInitialized();
        if (nftCode.length == 0 || poolCode.length == 0 || routerCode.length == 0) revert MissingBytecode();
        if (msg.value < factoryFee) revert InsufficientFee();
        if (poolSeedBps_ + treasuryBps_ > 10000) revert InvalidBps();

        uint256 salt = uint256(keccak256(abi.encodePacked(msg.sender, collections.length)));

        // 1. Deploy NFT with the same mintPrice configuration as the router.
        // Public mint remains owner-gated at the NFT layer, but the price stays coherent.
        nftAddr = _deploy(abi.encodePacked(
            nftCode,
            abi.encode(name_, symbol_, bitDepth_, defaultWidth_, defaultHeight_, maxSupply_, mintPrice_, paletteRGB)
        ), salt);

        // 2. Deploy Pool
        poolAddr = _deploy(abi.encodePacked(
            poolCode,
            abi.encode(nftAddr, mintPrice_)
        ), salt + 1);

        // 3. Deploy Router
        routerAddr = _deploy(abi.encodePacked(
            routerCode,
            abi.encode(nftAddr, poolAddr, msg.sender, mintPrice_, poolSeedBps_, treasuryBps_)
        ), salt + 2);

        // 4. Wire permissions
        ISetup(nftAddr).setMinter(routerAddr, true);
        ISetup(nftAddr).setBurner(poolAddr, true);
        ISetup(poolAddr).setRouter(routerAddr);

        // 5. Transfer ownership to creator
        ISetup(nftAddr).transferOwnership(msg.sender);
        ISetup(poolAddr).transferOwnership(msg.sender);
        ISetup(routerAddr).transferOwnership(msg.sender);

        // 6. Store
        collectionInfo[nftAddr] = Collection(nftAddr, poolAddr, routerAddr, msg.sender, block.timestamp);
        collections.push(nftAddr);

        emit CollectionCreated(msg.sender, nftAddr, poolAddr, routerAddr, name_, symbol_);
    }

    function _deploy(bytes memory bytecode, uint256 salt) private returns (address addr) {
        bytes32 s = bytes32(salt);
        assembly { addr := create2(0, add(bytecode, 0x20), mload(bytecode), s) }
        require(addr != address(0), "Deploy failed");
    }

    // ============================================================
    //                    VIEW
    // ============================================================

    function totalCollections() external view returns (uint256) { return collections.length; }

    function getCollection(uint256 i) external view returns (
        address nft, address pool, address router, address creator, uint256 createdAt
    ) {
        Collection memory c = collectionInfo[collections[i]];
        return (c.nft, c.pool, c.router, c.creator, c.createdAt);
    }

    // ============================================================
    //                    ADMIN
    // ============================================================

    function setFactoryFee(uint256 fee) external onlyOwner { factoryFee = fee; }
    function withdraw() external onlyOwner {
        (bool s, ) = msg.sender.call{value: address(this).balance}(""); require(s);
    }
}
