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

    event CollectionCreated(
        address indexed creator,
        address nft,
        address pool,
        address router
    );
    event NFTCodeUpdated(uint256 length);
    event PoolCodeUpdated(uint256 length);
    event RouterCodeUpdated(uint256 length);
    event FactoryFeeUpdated(uint256 previousFee, uint256 newFee);
    event FactoryWithdrawn(address indexed to, uint256 amount);

    struct Collection {
        address pool;
        address router;
        address creator;
        uint64 createdAt;
    }

    address[] public collections;
    mapping(address => Collection) public collectionInfo;

    /// @notice Stored creation bytecodes (set once by owner)
    bytes public nftCode;
    bytes public poolCode;
    bytes public routerCode;
    
    uint256 public factoryFee;

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
        if (nftCode.length == 0 || poolCode.length == 0 || routerCode.length == 0) revert MissingBytecode();
        if (mintPrice_ == 0) revert InvalidAmount();
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
        ISetup(poolAddr).setListingVault(msg.sender);

        // 5. Transfer ownership to creator
        ISetup(nftAddr).transferOwnership(msg.sender);
        ISetup(poolAddr).transferOwnership(msg.sender);
        ISetup(routerAddr).transferOwnership(msg.sender);

        // 6. Store
        collectionInfo[nftAddr] = Collection(poolAddr, routerAddr, msg.sender, uint64(block.timestamp));
        collections.push(nftAddr);

        emit CollectionCreated(msg.sender, nftAddr, poolAddr, routerAddr);
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
        address nft, address pool, address router, address creator, uint256 createdAt
    ) {
        nft = collections[i];
        Collection memory c = collectionInfo[nft];
        return (nft, c.pool, c.router, c.creator, uint256(c.createdAt));
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
