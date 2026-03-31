// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/IOnChainPixel.sol";
import "./libraries/SSTORE2.sol";
import "./libraries/PixelDecoder.sol";
import "./libraries/SVGRenderer.sol";

/// @title OnChainPixelNFT
/// @notice Fully on-chain pixel art NFT with SSTORE2-backed storage
/// @dev Aligns the collection contract with the router/factory interfaces used elsewhere in the repo
contract OnChainPixelNFT is ERC721, Ownable, IOnChainPixel {
    using Strings for uint256;

    error InvalidAmount();
    error InvalidCanvasSize();
    error InvalidPixelData();
    error InvalidBitDepth();
    error PaletteNotSet();
    error PaletteAlreadyLocked();
    error MaxSupplyReached();
    error TokenDoesNotExist();
    error WithdrawFailed();
    error NotMinter();
    error NotBurner();
    error PublicMintDisabled();
    error ZeroAddress();

    uint8 public constant MIN_SIZE = 1;
    uint8 public constant MAX_SIZE = 64;
    uint16 public constant MAX_PIXELS = 4096;

    uint8 private immutable _bitDepth;
    uint8 private immutable _defaultWidth;
    uint8 private immutable _defaultHeight;
    uint256 private immutable _maxSupply;

    address private _palettePointer;
    bool private _paletteLocked;
    uint16 private _paletteColorCount;

    uint256 public mintPrice;
    uint256 private _nextTokenId;
    uint256 private _burnedCount;
    bool public publicMintEnabled;

    mapping(uint256 => address) private _pixelPointers;
    mapping(uint256 => uint16) private _tokenDimensions;
    mapping(address => bool) public isMinter;
    mapping(address => bool) public isBurner;

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
        if (maxSupply_ == 0 || mintPrice_ == 0) revert InvalidAmount();
        if (bitDepth_ != 2 && bitDepth_ != 4 && bitDepth_ != 8) {
            revert InvalidBitDepth();
        }
        if (
            defaultWidth_ < MIN_SIZE ||
            defaultWidth_ > MAX_SIZE ||
            defaultHeight_ < MIN_SIZE ||
            defaultHeight_ > MAX_SIZE ||
            uint16(defaultWidth_) * uint16(defaultHeight_) > MAX_PIXELS
        ) {
            revert InvalidCanvasSize();
        }

        _bitDepth = bitDepth_;
        _defaultWidth = defaultWidth_;
        _defaultHeight = defaultHeight_;
        _maxSupply = maxSupply_;
        mintPrice = mintPrice_;

        if (paletteRGB.length > 0) {
            _setPalette(paletteRGB);
        }
    }

    /// @notice Legacy selector retained for ABI compatibility; direct public mint is disabled.
    function mint(bytes calldata) external payable {
        revert PublicMintDisabled();
    }

    /// @notice Legacy selector retained for ABI compatibility; direct public mint is disabled.
    function mintCustom(bytes calldata, uint8, uint8) external payable {
        revert PublicMintDisabled();
    }

    function mintTo(address to, bytes calldata pixelData_) external returns (uint256 tokenId) {
        if (!isMinter[msg.sender]) revert NotMinter();
        return _mintPixelTo(to, pixelData_, _defaultWidth, _defaultHeight);
    }

    function mintToCustom(address to, bytes calldata pixelData_, uint8 width, uint8 height)
        external returns (uint256 tokenId)
    {
        if (!isMinter[msg.sender]) revert NotMinter();
        return _mintPixelTo(to, pixelData_, width, height);
    }

    function _mintPixelTo(address to, bytes calldata pixelData_, uint8 width, uint8 height)
        private returns (uint256 tokenId)
    {
        if (_maxSupply > 0 && _nextTokenId >= _maxSupply) revert MaxSupplyReached();
        if (_palettePointer == address(0)) revert PaletteNotSet();
        if (
            width < MIN_SIZE ||
            width > MAX_SIZE ||
            height < MIN_SIZE ||
            height > MAX_SIZE ||
            uint16(width) * uint16(height) > MAX_PIXELS
        ) {
            revert InvalidCanvasSize();
        }

        uint256 expectedSize = PixelDecoder.expectedDataSize(width, height, _bitDepth);
        if (pixelData_.length != expectedSize) revert InvalidPixelData();

        tokenId = _nextTokenId++;
        _pixelPointers[tokenId] = SSTORE2.write(pixelData_);
        _tokenDimensions[tokenId] = (uint16(width) << 8) | uint16(height);

        _safeMint(to, tokenId);
        emit PixelDataStored(tokenId, width, height);
    }

    function canvasSize(uint256 tokenId) external view override returns (uint8 width, uint8 height) {
        _requireTokenExists(tokenId);
        uint16 packed = _tokenDimensions[tokenId];
        width = uint8(packed >> 8);
        height = uint8(packed & 0xFF);
    }

    function pixelData(uint256 tokenId) external view override returns (bytes memory) {
        _requireTokenExists(tokenId);
        return SSTORE2.read(_pixelPointers[tokenId]);
    }

    function getPixel(uint256 tokenId, uint8 x, uint8 y) external view override returns (uint8 r, uint8 g, uint8 b) {
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

    function palette() external view override returns (bytes memory) {
        if (_palettePointer == address(0)) revert PaletteNotSet();
        return SSTORE2.read(_palettePointer);
    }

    function paletteSize() external view override returns (uint16) {
        return _paletteColorCount;
    }

    function renderSVG(uint256 tokenId) public view override returns (string memory) {
        _requireTokenExists(tokenId);

        uint16 packed = _tokenDimensions[tokenId];
        uint8 width = uint8(packed >> 8);
        uint8 height = uint8(packed & 0xFF);

        bytes memory data = SSTORE2.read(_pixelPointers[tokenId]);
        bytes memory pal = SSTORE2.read(_palettePointer);
        return SVGRenderer.render(data, pal, width, height, _bitDepth);
    }

    function bitDepth() external view override returns (uint8) {
        return _bitDepth;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
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

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IOnChainPixel).interfaceId || super.supportsInterface(interfaceId);
    }

    function setMinter(address minter, bool authorized) external onlyOwner {
        if (authorized && minter == address(0)) revert ZeroAddress();
        isMinter[minter] = authorized;
    }

    function setBurner(address burner, bool authorized) external onlyOwner {
        if (authorized && burner == address(0)) revert ZeroAddress();
        isBurner[burner] = authorized;
    }

    function setPalette(bytes calldata paletteRGB) external onlyOwner {
        if (_paletteLocked) revert PaletteAlreadyLocked();
        _setPalette(paletteRGB);
    }

    function lockPalette() external onlyOwner {
        _paletteLocked = true;
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidAmount();
        mintPrice = newPrice;
    }

    function setPublicMintEnabled(bool enabled) external onlyOwner {
        if (enabled) revert PublicMintDisabled();
        publicMintEnabled = false;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success,) = msg.sender.call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - _burnedCount;
    }

    function maxSupply() external view returns (uint256) {
        return _maxSupply;
    }

    function defaultCanvasSize() external view returns (uint8 width, uint8 height) {
        return (_defaultWidth, _defaultHeight);
    }

    function paletteLocked() external view returns (bool) {
        return _paletteLocked;
    }

    function protocolBurn(uint256 tokenId) external {
        if (!isBurner[msg.sender]) revert NotBurner();
        _requireTokenExists(tokenId);
        _burn(tokenId);
        delete _pixelPointers[tokenId];
        delete _tokenDimensions[tokenId];
        _burnedCount += 1;
    }

    function _setPalette(bytes memory paletteRGB) private {
        uint256 maxColors = 1 << _bitDepth;
        if (paletteRGB.length == 0 || paletteRGB.length % 3 != 0) revert InvalidPixelData();

        uint256 colorCount = paletteRGB.length / 3;
        if (colorCount > maxColors) revert InvalidPixelData();

        _palettePointer = SSTORE2.write(paletteRGB);
        _paletteColorCount = uint16(colorCount);
        emit PaletteUpdated(uint16(colorCount));
    }

    function _requireTokenExists(uint256 tokenId) private view {
        if (_pixelPointers[tokenId] == address(0)) revert TokenDoesNotExist();
    }
}
