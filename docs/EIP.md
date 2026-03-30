---
eip: XXXX
title: On-Chain Pixel Art Interface
description: An ERC interface for NFTs whose pixel art data is stored entirely on-chain as palette-indexed bitmaps
author: @yourhandle
discussions-to: https://ethereum-magicians.org/t/eip-xxxx-on-chain-pixel-art-interface
status: Draft
type: Standards Track
category: ERC
created: 2026-03-24
requires: 165, 721
---

## Abstract

This EIP defines a standard interface for NFT collections whose visual representation is stored entirely on-chain as palette-indexed bitmap data.

The standard specifies:

- how a collection exposes packed pixel data
- how a global palette is exposed
- how other contracts can read dimensions and individual pixels
- how a token can expose an on-chain SVG rendering

This EIP standardizes the NFT data and rendering interface. It does not standardize mint economics, marketplace logic, AMMs, treasury systems, or collection launch mechanics.

## Motivation

Most NFTs still depend on off-chain image infrastructure. Even when metadata is on-chain, the underlying visual asset often is not.

That creates four persistent problems:

**Permanence**

Off-chain images can disappear, become censored, or rely on gateways that users do not control.

**Composability**

Smart contracts cannot meaningfully read or react to an image that only exists behind an off-chain URI.

**Verifiability**

Without an on-chain visual representation, contracts and users must trust off-chain infrastructure to serve the correct art.

**Fragmentation**

Projects that do store pixel art on-chain often invent incompatible custom interfaces, which limits reuse by marketplaces, wallets, games, and derivative contracts.

This EIP solves those problems by defining a reusable interface for on-chain pixel art NFTs.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

### Interface

Compliant contracts MUST implement ERC-165 and the following interface:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOnChainPixel {
    event PixelDataStored(uint256 indexed tokenId, uint8 width, uint8 height);
    event PaletteUpdated(uint16 colorCount);

    function canvasSize(uint256 tokenId)
        external
        view
        returns (uint8 width, uint8 height);

    function pixelData(uint256 tokenId)
        external
        view
        returns (bytes memory);

    function getPixel(uint256 tokenId, uint8 x, uint8 y)
        external
        view
        returns (uint8 r, uint8 g, uint8 b);

    function palette() external view returns (bytes memory);

    function paletteSize() external view returns (uint16);

    function renderSVG(uint256 tokenId)
        external
        view
        returns (string memory);

    function bitDepth() external view returns (uint8);
}
```

### ERC-165 Detection

Compliant contracts MUST return `true` for `type(IOnChainPixel).interfaceId`.

Implementations SHOULD also expose compatibility with their underlying token standard, such as ERC-721 or ERC-1155.

### Pixel Data Format

#### Palette

Each collection MUST expose a collection-level palette as packed RGB bytes:

`[R0,G0,B0,R1,G1,B1,...]`

Each color component is a `uint8`.

The maximum palette size MUST NOT exceed `2^bitDepth`.

#### Bit Depth

`bitDepth()` MUST return one of:

- `2`
- `4`
- `8`

The bit depth SHOULD be immutable after deployment.

#### Pixel Packing

Pixel data MUST be stored as packed palette indices.

For `4-bit` collections:

- one byte contains two pixels
- high nibble = first pixel
- low nibble = second pixel

For `2-bit` collections:

- one byte contains four pixels
- bits `[7:6]`, `[5:4]`, `[3:2]`, `[1:0]` represent consecutive pixels

For `8-bit` collections:

- one byte contains one pixel

#### Scan Order

Pixels MUST be encoded in row-major order:

`index = y * width + x`

#### Data Length

For a token with `width`, `height`, and `bitDepth`, the packed pixel data length MUST equal:

`ceil(width * height * bitDepth / 8)`

### Canvas Constraints

This EIP does not mandate a single universal canvas bound, but implementations SHOULD define explicit limits.

The reference implementation in this repository uses:

- width between `1` and `64`
- height between `1` and `64`
- total pixels `<= 4096`

### Rendering

`renderSVG(tokenId)` MUST return a valid SVG string representing the token's current pixel artwork.

The returned SVG:

- MUST be deterministic for a given token state
- SHOULD use crisp pixel rendering
- SHOULD map palette indices to visible color output
- MAY omit pixels that the implementation treats as transparent

This EIP does not require a particular SVG optimization strategy.

### Storage

This EIP does not mandate a specific storage mechanism.

Implementations MAY use:

- normal Solidity storage
- SSTORE2-style bytecode storage
- any equivalent immutable byte storage method

SSTORE2-like storage is RECOMMENDED for gas efficiency when pixel payloads are large enough to justify it.

## Rationale

### Why Palette-Indexed Pixel Data

Palette-indexed storage is a natural fit for pixel art.

Compared with raw RGB storage, it:

- reduces storage size dramatically
- keeps color management collection-wide
- makes on-chain decoding and rendering more practical

### Why Standardize Read Functions

`pixelData`, `canvasSize`, and `getPixel` make the art legible to other contracts.

That enables:

- on-chain composability
- derivative art systems
- games and trait logic based on the artwork itself

### Why Include `renderSVG`

A rendering function makes the standard immediately useful to:

- wallets
- NFT marketplaces
- indexers
- lightweight clients

It also gives contracts a canonical on-chain visual representation without depending on off-chain renderers.

### Why Keep Minting Out Of Scope

Mint logic is highly project-specific.

Collections may differ on:

- who can mint
- whether minting is public or role-gated
- whether canvas size is fixed or custom
- whether palette changes are allowed before locking

Standardizing the read/render layer without standardizing mint policy keeps the interface broadly reusable.

## Backwards Compatibility

This EIP is an extension interface. It is compatible with ERC-721 and can also be implemented alongside ERC-1155.

Existing NFT collections that do not implement `IOnChainPixel` are unaffected.

## Reference Implementation

The current repository includes a reference implementation in:

- [contracts/interfaces/IOnChainPixel.sol](../contracts/interfaces/IOnChainPixel.sol)
- [contracts/OnChainPixelNFT.sol](../contracts/OnChainPixelNFT.sol)

Important implementation notes:

- Solidity pragma: `^0.8.17`
- ERC-721 based
- palette and pixel data stored via SSTORE2-style pointers
- bit depth fixed per collection
- canvas dimensions stored per token
- SVG fully rendered on-chain

The current reference implementation also includes collection-specific mint and admin extensions, but those are not required by this EIP.

## Security Considerations

### Palette Mutability

If a collection allows its palette to change after tokens are minted, the visual output of previously minted NFTs may change.

Implementations that allow palette updates SHOULD also support a permanent locking mechanism.

### Input Validation

Implementations MUST validate:

- pixel data length for the declared dimensions and bit depth
- valid canvas bounds
- palette length and palette size relative to bit depth

### View Function Cost

Rendering large SVGs on-chain can be expensive in `eth_call` context.

Implementers SHOULD document practical canvas limits and be aware that some RPC providers apply restrictive call gas defaults.

### Determinism

The visual result exposed by `renderSVG` SHOULD be deterministic for the same stored token state. Hidden off-chain dependencies would undermine the purpose of the standard.

## Copyright

Copyright and related rights waived via CC0.
