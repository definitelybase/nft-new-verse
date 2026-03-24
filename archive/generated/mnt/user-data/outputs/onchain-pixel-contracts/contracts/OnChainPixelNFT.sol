// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/utils/Base64.sol";
import "../node_modules/@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IOnChainPixel.sol";
import "./libraries/SSTORE2.sol";
import "./libraries/PixelDecoder.sol";
import "./libraries/SVGRenderer.sol";

/// @title OnChainPixelNFT
/// @notice Fully on-chain pixel art NFT with SSTORE2 storage
/// @dev Implements ERC-721 + IOnChainPixel standard
///      - Global palette stored once via SSTORE2
///      - Each token's pixel data stored via SSTORE2
///      - SVG rendered entirely on-chain
///      - No IPFS, no AWS, no external dependencies
contract OnChainPixelNFT is ERC721, Ownable, IOnChainPixel {
    using Strings for uint256;

    // ============================================================
    //                        ERRORS
    // ============================================================

    error InvalidCanvasSize();
    error InvalidPixelData();
    error InvalidBitDepth();
    error PaletteNotSet();
    error PaletteAlreadyLocked();
    error MintPriceNotMet();
    error MaxSupplyReached();
    error TokenDoesNotExist();
    error WithdrawFailed();

    // ============================================================
    //                       CONSTANTS
    // ============================================================

    uint8 public constant MIN_SIZE = 1;
    uint8 public constant MAX_SIZE = 64;
    uint16 public constant MAX_PIXELS = 4096; // 64 * 64

    // ============================================================
    //                    IMMUTABLE CONFIG
    // ============================================================

    /// @notice Bits per pixel (2, 4, or 8) — set at deploy, never changes
    uint8 private immutable _bitDepth;

    /// @notice Default canvas width for the collection
    uint8 private immutable _defaultWidth;

    /// @notice Default canvas height for the collection
    uint8 private immutable _defaultHeight;

    /// @notice Maximum supply (0 = unlimited)
    uint256 private immutable _maxSupply;

    // ============================================================
    //                        STORAGE
    // ============================================================

    /// @notice SSTORE2 pointer to palette data
    address private _palettePointer;

    /// @notice Whether palette is locked (can't be changed)
    bool private _paletteLocked;

    /// @notice Number of colors in palette
    uint16 private _paletteColorCount;

    /// @notice Mint price in wei
    uint256 public mintPrice;

    /// @notice Current token ID counter
    uint256 private _nextTokenId;

    /// @notice Token pixel data pointers (tokenId → SSTORE2 address)
    mapping(uint256 => address) private _pixelPointers;

    /// @notice Token canvas dimensions (tokenId → packed width|height)
    /// @dev Packed as uint16: (width << 8) | height
    mapping(uint256 => uint16) private _tokenDimensions;

    // ============================================================
    //                      CONSTRUCTOR
    // ============================================================

    /// @notice Deploy a new OnChainPixel collection
    /// @param name_ Collection name
    /// @param symbol_ Collection symbol
    /// @param bitDepth_ Bits per pixel (2, 4, or 8)
    /// @param defaultWidth_ Default canvas width
    /// @param defaultHeight_ Default canvas height
    /// @param maxSupply_ Maximum supply (0 = unlimited)
    /// @param mintPrice_ Price per mint in wei
    /// @param paletteRGB Packed RGB palette bytes [R0,G0,B0, R1,G1,B1, ...]
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 bitDepth_,
        uint8 defaultWidth_,
        uint8 defaultHeight_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        bytes memory paletteRGB
    ) ERC721(name_, symbol_) Ownable() {
        // Validate bit depth
        if (bitDepth_ != 2 && bitDepth_ != 4 && bitDepth_ != 8) {
            revert InvalidBitDepth();
        }

        // Validate default dimensions
        if (defaultWidth_ < MIN_SIZE || defaultWidth_ > MAX_SIZE ||
            defaultHeight_ < MIN_SIZE || defaultHeight_ > MAX_SIZE ||
            uint16(defaultWidth_) * uint16(defaultHeight_) > MAX_PIXELS) {
            revert InvalidCanvasSize();
        }

        _bitDepth = bitDepth_;
        _defaultWidth = defaultWidth_;
        _defaultHeight = defaultHeight_;
        _maxSupply = maxSupply_;
        mintPrice = mintPrice_;

        // Store palette via SSTORE2
        if (paletteRGB.length > 0) {
            _setPalette(paletteRGB);
        }
    }

    // ============================================================
    //                        MINTING
    // ============================================================

    /// @notice Mint a new pixel art NFT with default canvas size
    /// @param pixelData_ Packed pixel indices
    function mint(bytes calldata pixelData_) external payable {
        _mintPixel(pixelData_, _defaultWidth, _defaultHeight);
    }

    /// @notice Mint a new pixel art NFT with custom canvas size
    /// @param pixelData_ Packed pixel indices
    /// @param width Canvas width
    /// @param height Canvas height
    function mintCustom(bytes calldata pixelData_, uint8 width, uint8 height) 
        external payable 
    {
        _mintPixel(pixelData_, width, height);
    }

    function _mintPixel(bytes calldata pixelData_, uint8 width, uint8 height) 
        private 
    {
        // Checks
        if (msg.value < mintPrice) revert MintPriceNotMet();
        if (_maxSupply > 0 && _nextTokenId >= _maxSupply) revert MaxSupplyReached();
        if (_palettePointer == address(0)) revert PaletteNotSet();

        if (width < MIN_SIZE || width > MAX_SIZE ||
            height < MIN_SIZE || height > MAX_SIZE ||
            uint16(width) * uint16(height) > MAX_PIXELS) {
            revert InvalidCanvasSize();
        }

        // Validate pixel data length
        uint256 expectedSize = PixelDecoder.expectedDataSize(width, height, _bitDepth);
        if (pixelData_.length != expectedSize) revert InvalidPixelData();

        // Assign token ID
        uint256 tokenId = _nextTokenId++;

        // Store pixel data via SSTORE2
        _pixelPointers[tokenId] = SSTORE2.write(pixelData_);

        // Store dimensions (packed into one uint16)
        _tokenDimensions[tokenId] = (uint16(width) << 8) | uint16(height);

        // Mint ERC-721
        _safeMint(msg.sender, tokenId);

        emit PixelDataStored(tokenId, width, height);
    }

    // ============================================================
    //                    IOnChainPixel — PIXEL DATA
    // ============================================================

    /// @inheritdoc IOnChainPixel
    function canvasSize(uint256 tokenId) 
        external view override returns (uint8 width, uint8 height) 
    {
        _requireTokenExists(tokenId);
        uint16 packed = _tokenDimensions[tokenId];
        width = uint8(packed >> 8);
        height = uint8(packed & 0xFF);
    }

    /// @inheritdoc IOnChainPixel
    function pixelData(uint256 tokenId) 
        external view override returns (bytes memory) 
    {
        _requireTokenExists(tokenId);
        return SSTORE2.read(_pixelPointers[tokenId]);
    }

    /// @inheritdoc IOnChainPixel
    function getPixel(uint256 tokenId, uint8 x, uint8 y) 
        external view override returns (uint8 r, uint8 g, uint8 b) 
    {
        _requireTokenExists(tokenId);
        
        uint16 packed = _tokenDimensions[tokenId];
        uint8 width = uint8(packed >> 8);
        uint8 height = uint8(packed & 0xFF);

        if (x >= width || y >= height) revert InvalidCanvasSize();

        bytes memory data = SSTORE2.read(_pixelPointers[tokenId]);
        uint256 pixelIndex = uint256(y) * uint256(width) + uint256(x);
        uint8 colorIdx = PixelDecoder.getColorIndex(data, pixelIndex, _bitDepth);

        bytes memory pal = SSTORE2.read(_palettePointer);
        uint256 offset = uint256(colorIdx) * 3;
        r = uint8(pal[offset]);
        g = uint8(pal[offset + 1]);
        b = uint8(pal[offset + 2]);
    }

    // ============================================================
    //                    IOnChainPixel — PALETTE
    // ============================================================

    /// @inheritdoc IOnChainPixel
    function palette() external view override returns (bytes memory) {
        if (_palettePointer == address(0)) revert PaletteNotSet();
        return SSTORE2.read(_palettePointer);
    }

    /// @inheritdoc IOnChainPixel
    function paletteSize() external view override returns (uint16) {
        return _paletteColorCount;
    }

    // ============================================================
    //                    IOnChainPixel — RENDERING
    // ============================================================

    /// @inheritdoc IOnChainPixel
    function renderSVG(uint256 tokenId) 
        public view override returns (string memory) 
    {
        _requireTokenExists(tokenId);

        uint16 packed = _tokenDimensions[tokenId];
        uint8 width = uint8(packed >> 8);
        uint8 height = uint8(packed & 0xFF);

        bytes memory data = SSTORE2.read(_pixelPointers[tokenId]);
        bytes memory pal = SSTORE2.read(_palettePointer);

        return SVGRenderer.render(data, pal, width, height, _bitDepth);
    }

    // ============================================================
    //                    IOnChainPixel — CONFIG
    // ============================================================

    /// @inheritdoc IOnChainPixel
    function bitDepth() external view override returns (uint8) {
        return _bitDepth;
    }

    // ============================================================
    //                       TOKEN URI
    // ============================================================

    /// @notice Returns fully on-chain tokenURI with SVG image
    function tokenURI(uint256 tokenId) 
        public view override returns (string memory) 
    {
        _requireTokenExists(tokenId);

        uint16 packed = _tokenDimensions[tokenId];
        uint8 width = uint8(packed >> 8);
        uint8 height = uint8(packed & 0xFF);

        string memory svg = renderSVG(tokenId);
        string memory svgBase64 = Base64.encode(bytes(svg));

        string memory json = string(
            abi.encodePacked(
                '{"name":"', name(), ' #', tokenId.toString(),
                '","description":"Fully on-chain pixel art. No IPFS. No servers. Forever."',
                ',"image":"data:image/svg+xml;base64,', svgBase64,
                '","attributes":[',
                '{"trait_type":"Width","value":', uint256(width).toString(), '},',
                '{"trait_type":"Height","value":', uint256(height).toString(), '},',
                '{"trait_type":"Colors","value":', uint256(_paletteColorCount).toString(), '},',
                '{"trait_type":"Bit Depth","value":', uint256(_bitDepth).toString(), '},',
                '{"trait_type":"Storage","value":"On-Chain"}',
                ']}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    // ============================================================
    //                      ERC-165
    // ============================================================

    function supportsInterface(bytes4 interfaceId) 
        public view override returns (bool) 
    {
        return 
            interfaceId == type(IOnChainPixel).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // ============================================================
    //                      ADMIN
    // ============================================================

    /// @notice Update palette (only if not locked)
    function setPalette(bytes calldata paletteRGB) external onlyOwner {
        if (_paletteLocked) revert PaletteAlreadyLocked();
        _setPalette(paletteRGB);
    }

    /// @notice Lock palette permanently — cannot be undone
    function lockPalette() external onlyOwner {
        _paletteLocked = true;
    }

    /// @notice Update mint price
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    /// @notice Withdraw collected ETH
    function withdraw() external onlyOwner {
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        if (!success) revert WithdrawFailed();
    }

    // ============================================================
    //                      INTERNAL
    // ============================================================

    function _setPalette(bytes memory paletteRGB) private {
        uint256 maxColors = 1 << _bitDepth; // 4, 16, or 256
        if (paletteRGB.length == 0 || paletteRGB.length % 3 != 0) {
            revert InvalidPixelData();
        }
        uint256 colorCount = paletteRGB.length / 3;
        if (colorCount > maxColors) revert InvalidPixelData();

        _palettePointer = SSTORE2.write(paletteRGB);
        _paletteColorCount = uint16(colorCount);

        emit PaletteUpdated(uint16(colorCount));
    }

    function _requireTokenExists(uint256 tokenId) private view {
        if (_pixelPointers[tokenId] == address(0)) revert TokenDoesNotExist();
    }

    // ============================================================
    //                      VIEW HELPERS
    // ============================================================

    /// @notice Returns total minted supply
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Returns max supply (0 = unlimited)
    function maxSupply() external view returns (uint256) {
        return _maxSupply;
    }

    /// @notice Returns default canvas dimensions
    function defaultCanvasSize() external view returns (uint8 width, uint8 height) {
        return (_defaultWidth, _defaultHeight);
    }

    /// @notice Returns whether palette is locked
    function paletteLocked() external view returns (bool) {
        return _paletteLocked;
    }
}
