// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PixelDecoder.sol";

/// @title SVGRenderer
/// @notice Renders on-chain pixel data to SVG format
/// @dev Uses run merging: consecutive same-color pixels on a row → single <rect>
library SVGRenderer {
    
    /// @notice Generates a complete SVG string from pixel data and palette
    /// @param data Packed pixel data
    /// @param paletteData Packed RGB palette [R0,G0,B0, R1,G1,B1, ...]
    /// @param width Canvas width in pixels
    /// @param height Canvas height in pixels
    /// @param bpp Bits per pixel
    /// @return svg The complete SVG string
    function render(
        bytes memory data,
        bytes memory paletteData,
        uint8 width,
        uint8 height,
        uint8 bpp
    ) internal pure returns (string memory svg) {
        // Build SVG header
        string memory header = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ',
                _toString(width),
                " ",
                _toString(height),
                '" shape-rendering="crispEdges">'
            )
        );

        // Build all rects with run merging
        bytes memory rects = _buildRects(data, paletteData, width, height, bpp);

        svg = string(abi.encodePacked(header, rects, "</svg>"));
    }

    /// @notice Builds SVG rect elements with horizontal run merging
    /// @dev Consecutive same-color pixels in a row become a single rect
    function _buildRects(
        bytes memory data,
        bytes memory paletteData,
        uint8 width,
        uint8 height,
        uint8 bpp
    ) private pure returns (bytes memory rects) {
        rects = "";

        for (uint8 y = 0; y < height; y++) {
            uint8 x = 0;
            while (x < width) {
                uint256 pixelIndex = uint256(y) * uint256(width) + uint256(x);
                uint8 colorIdx = PixelDecoder.getColorIndex(data, pixelIndex, bpp);

                // Skip transparent pixels (index 0 = transparent)
                if (colorIdx == 0) {
                    x++;
                    continue;
                }

                // Run merging: count consecutive same-color pixels
                uint8 runLength = 1;
                while (x + runLength < width) {
                    uint256 nextPixel = pixelIndex + uint256(runLength);
                    uint8 nextColor = PixelDecoder.getColorIndex(data, nextPixel, bpp);
                    if (nextColor != colorIdx) break;
                    runLength++;
                }

                // Get RGB from palette
                string memory hexColor = _paletteColor(paletteData, colorIdx);

                // Generate rect
                rects = abi.encodePacked(
                    rects,
                    '<rect x="', _toString(x),
                    '" y="', _toString(y),
                    '" width="', _toString(runLength),
                    '" height="1" fill="#', hexColor, '"/>'
                );

                x += runLength;
            }
        }
    }

    /// @notice Extracts hex color string from palette data
    /// @param paletteData Packed RGB bytes
    /// @param colorIndex Index into palette
    /// @return 6-character hex string (e.g., "FF00AA")
    function _paletteColor(bytes memory paletteData, uint8 colorIndex) 
        private pure returns (string memory) 
    {
        uint256 offset = uint256(colorIndex) * 3;
        uint8 r = uint8(paletteData[offset]);
        uint8 g = uint8(paletteData[offset + 1]);
        uint8 b = uint8(paletteData[offset + 2]);
        return _toHexColor(r, g, b);
    }

    /// @notice Converts RGB to 6-char hex string
    function _toHexColor(uint8 r, uint8 g, uint8 b) 
        private pure returns (string memory) 
    {
        bytes memory hexChars = "0123456789ABCDEF";
        bytes memory result = new bytes(6);
        result[0] = hexChars[r >> 4];
        result[1] = hexChars[r & 0x0F];
        result[2] = hexChars[g >> 4];
        result[3] = hexChars[g & 0x0F];
        result[4] = hexChars[b >> 4];
        result[5] = hexChars[b & 0x0F];
        return string(result);
    }

    /// @notice Converts uint8 to decimal string
    function _toString(uint8 value) private pure returns (string memory) {
        if (value == 0) return "0";
        
        uint8 temp = value;
        uint8 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
