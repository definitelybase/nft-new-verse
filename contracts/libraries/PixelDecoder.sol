// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title PixelDecoder
/// @notice Decodes packed pixel data into individual color indices
/// @dev Supports 2-bit (4 colors), 4-bit (16 colors), and 8-bit (256 colors)
library PixelDecoder {
    error DecoderInvalidBitDepth();
    error PixelOutOfBounds();

    /// @notice Extracts a single pixel's color index from packed data
    /// @param data Packed pixel data
    /// @param pixelIndex Linear index of the pixel (y * width + x)
    /// @param bpp Bits per pixel (2, 4, or 8)
    /// @return colorIndex The palette color index for this pixel
    function getColorIndex(
        bytes memory data,
        uint256 pixelIndex,
        uint8 bpp
    ) internal pure returns (uint8 colorIndex) {
        if (bpp == 4) {
            // 4-bit: 2 pixels per byte
            uint256 byteIndex = pixelIndex >> 1; // pixelIndex / 2
            uint8 rawByte = uint8(data[byteIndex]);
            
            if (pixelIndex & 1 == 0) {
                // Even pixel: high nibble (bits 7-4)
                colorIndex = rawByte >> 4;
            } else {
                // Odd pixel: low nibble (bits 3-0)
                colorIndex = rawByte & 0x0F;
            }
        } else if (bpp == 8) {
            // 8-bit: 1 pixel per byte
            colorIndex = uint8(data[pixelIndex]);
        } else if (bpp == 2) {
            // 2-bit: 4 pixels per byte
            uint256 byteIndex = pixelIndex >> 2; // pixelIndex / 4
            uint8 rawByte = uint8(data[byteIndex]);
            uint8 shift = uint8(6 - (2 * (pixelIndex & 3)));
            colorIndex = (rawByte >> shift) & 0x03;
        } else {
            revert DecoderInvalidBitDepth();
        }
    }

    /// @notice Calculates expected data size for given dimensions and bit depth
    /// @param width Canvas width
    /// @param height Canvas height
    /// @param bpp Bits per pixel
    /// @return size Expected data size in bytes
    function expectedDataSize(uint8 width, uint8 height, uint8 bpp) 
        internal pure returns (uint256 size) 
    {
        uint256 totalPixels = uint256(width) * uint256(height);
        uint256 totalBits = totalPixels * uint256(bpp);
        // Round up to nearest byte
        size = (totalBits + 7) / 8;
    }
}
