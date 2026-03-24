// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title IOnChainPixel — On-Chain Pixel Art Standard
/// @notice ERC extension for NFTs with pixel data stored entirely on-chain
/// @dev Designed to work alongside ERC-721 or ERC-1155.
///      Pixel data is stored via SSTORE2 as packed color indices.
///      A global palette maps indices to RGB colors.
///      SVG rendering is done entirely on-chain.
interface IOnChainPixel {
    // ============================================================
    //                          EVENTS
    // ============================================================

    /// @notice Emitted when pixel data is stored for a token
    event PixelDataStored(
        uint256 indexed tokenId,
        uint8 width,
        uint8 height
    );

    /// @notice Emitted when the palette is set or updated
    event PaletteUpdated(uint16 colorCount);

    // ============================================================
    //                      PIXEL DATA
    // ============================================================

    /// @notice Returns canvas dimensions for a token
    /// @param tokenId The NFT token ID
    /// @return width Canvas width in pixels
    /// @return height Canvas height in pixels
    function canvasSize(uint256 tokenId)
        external view returns (uint8 width, uint8 height);

    /// @notice Returns raw packed pixel index data for a token
    /// @param tokenId The NFT token ID
    /// @return Packed pixel indices (bitDepth bits per pixel)
    function pixelData(uint256 tokenId)
        external view returns (bytes memory);

    /// @notice Returns the RGB color of a specific pixel
    /// @param tokenId The NFT token ID
    /// @param x X coordinate (0-indexed, left to right)
    /// @param y Y coordinate (0-indexed, top to bottom)
    /// @return r Red component (0-255)
    /// @return g Green component (0-255)
    /// @return b Blue component (0-255)
    function getPixel(uint256 tokenId, uint8 x, uint8 y)
        external view returns (uint8 r, uint8 g, uint8 b);

    // ============================================================
    //                        PALETTE
    // ============================================================

    /// @notice Returns the global palette as packed RGB bytes
    /// @return Packed bytes: [R0,G0,B0, R1,G1,B1, ...]
    function palette() external view returns (bytes memory);

    /// @notice Returns number of colors in palette
    function paletteSize() external view returns (uint16);

    // ============================================================
    //                       RENDERING
    // ============================================================

    /// @notice Returns the rendered SVG image for a token
    /// @param tokenId The NFT token ID
    /// @return Full SVG string
    function renderSVG(uint256 tokenId)
        external view returns (string memory);

    // ============================================================
    //                      CONFIGURATION
    // ============================================================

    /// @notice Returns bits per pixel (2, 4, or 8)
    function bitDepth() external view returns (uint8);
}
