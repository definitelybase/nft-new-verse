# OnChainPixel NFT Spec

## Purpose

This document describes the `OnChainPixel` NFT layer itself.

It is intentionally separate from:

- `PixelPool`
- `PixelRouter`
- treasury math
- AMM market-state logic

Those systems use the NFT contract, but they are not part of the pixel NFT standard.

## Standard Surface

The reusable standard surface is `IOnChainPixel` in [contracts/interfaces/IOnChainPixel.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/interfaces/IOnChainPixel.sol).

It defines:

- `canvasSize(uint256)`
- `pixelData(uint256)`
- `getPixel(uint256,uint8,uint8)`
- `palette()`
- `paletteSize()`
- `renderSVG(uint256)`
- `bitDepth()`

It also defines the events:

- `PixelDataStored(uint256,uint8,uint8)`
- `PaletteUpdated(uint16)`

Any compliant collection should expose this interface via ERC-165.

## Reference Implementation In This Repository

The reference implementation is [contracts/OnChainPixelNFT.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/OnChainPixelNFT.sol).

This contract includes two layers:

### 1. Standard Layer

This is the reusable on-chain pixel NFT behavior:

- ERC-721 token ownership
- `IOnChainPixel`
- SSTORE2-backed pixel storage
- global packed RGB palette
- on-chain SVG rendering
- token-specific canvas dimensions

### 2. Collection-Specific Extensions

These are useful for the current protocol, but are not part of the base standard:

- `mint(bytes)`
- `mintCustom(bytes,uint8,uint8)`
- `mintTo(address,bytes)`
- `mintToCustom(address,bytes,uint8,uint8)`
- `setMinter(address,bool)`
- `defaultCanvasSize()`
- `maxSupply()`
- `setMintPrice(uint256)`
- `lockPalette()`
- `paletteLocked()`

The standard should be thought of as the read/render/data interface, not the mint policy.

## Pixel Storage Model

### Palette + Indices

Each collection stores one global palette as packed RGB bytes:

`[R0,G0,B0,R1,G1,B1,...]`

Each token stores only packed palette indices.

This is efficient because pixel art usually has a small shared color set, while per-token RGB storage would be much larger.

### Bit Depth

Supported bit depths:

- `2` bits per pixel
- `4` bits per pixel
- `8` bits per pixel

The deployed collection fixes `bitDepth` at construction time.

### Packing

#### 4-bit

- `2` pixels per byte
- high nibble = first pixel
- low nibble = second pixel

Example:

`0xA3 -> pixel0 = 10, pixel1 = 3`

#### 2-bit

- `4` pixels per byte
- `[7:6] = px0`
- `[5:4] = px1`
- `[3:2] = px2`
- `[1:0] = px3`

#### 8-bit

- `1` byte per pixel

### Scan Order

Pixels are packed in row-major order:

`index = y * width + x`

## Canvas Constraints

The current implementation uses:

- minimum size: `1x1`
- maximum width: `64`
- maximum height: `64`
- maximum total pixels: `4096`

This matches the practical bounds of the current renderer and keeps data size well within SSTORE2 limits.

## Data Size

Expected packed data length is:

`expectedDataSize = ceil(width * height * bitDepth / 8)`

Examples:

| Canvas | 2-bit | 4-bit | 8-bit |
|--------|-------|-------|-------|
| 8x8 | 16 B | 32 B | 64 B |
| 16x16 | 64 B | 128 B | 256 B |
| 24x24 | 144 B | 288 B | 576 B |
| 32x32 | 256 B | 512 B | 1024 B |
| 48x48 | 576 B | 1152 B | 2304 B |
| 64x64 | 1024 B | 2048 B | 4096 B |

## Palette Rules

The current implementation expects:

- packed RGB bytes
- length divisible by `3`
- non-empty palette
- total colors `<= 2^bitDepth`

Palette may be updated by the owner before locking.

Once locked:

- palette can no longer change

This protects already minted NFTs from visual reinterpretation.

## Rendering Model

`renderSVG(tokenId)` returns a full SVG string generated on-chain.

The renderer uses:

- canvas dimensions stored per token
- packed pixel data stored via SSTORE2
- collection palette
- bit depth to decode color indices

The SVG layer is intended for:

- `tokenURI`
- wallets
- marketplaces
- on-chain and off-chain render consumers

## tokenURI Model

The current reference implementation builds a fully on-chain JSON metadata payload:

- `name`
- `description`
- `image` as base64 SVG data URI
- width / height / colors / bit depth / storage attributes

This is implementation-specific, but strongly aligned with the project goal of fully on-chain permanence.

## Reference File Layout

The active NFT-layer files in this repository are:

- [contracts/OnChainPixelNFT.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/OnChainPixelNFT.sol)
- [contracts/interfaces/IOnChainPixel.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/interfaces/IOnChainPixel.sol)
- [contracts/libraries/SSTORE2.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/libraries/SSTORE2.sol)
- [contracts/libraries/PixelDecoder.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/libraries/PixelDecoder.sol)
- [contracts/libraries/SVGRenderer.sol](/Users/daniltkacev/Downloads/nft%20ponzo/contracts/libraries/SVGRenderer.sol)

## What Is Not Part Of The NFT Standard

The following are protocol-level systems, not standard-level requirements:

- liquidity pool pricing
- treasury reserve
- staking
- market-state transitions
- buyback and burn logic
- mint proceeds split
- router/factory deployment flow

These can evolve without changing the core `IOnChainPixel` standard.

## Implementation Notes

Current reference implementation details:

- Solidity pragma: `^0.8.17`
- OpenZeppelin ERC-721 + Ownable
- palette stored in SSTORE2
- pixel bytes stored per token in SSTORE2
- bit depth immutable per collection
- default canvas immutable per collection
- max supply immutable per collection

## Open Questions

These are still valid areas for future standard work:

- whether `defaultCanvasSize()` should ever be standardized
- whether collection-level mint hooks belong in a companion interface
- whether an ERC-1155 profile is worth formalizing
- whether palette locking should become a recommended interface extension

For now, the cleanest standard boundary remains `IOnChainPixel`.
