# Lessons Learned — OnChainPixel

## Bug: SSTORE2 Creation Code Offset (Critical)
**What happened**: SSTORE2 write function used `0x0a` (10) for CODECOPY offset, but the creation code was actually 12 bytes long (PUSH2 uses 3 bytes, not 1).
**Symptom**: Palette data returned with 2 garbage bytes at the start. All color lookups were shifted.
**Fix**: Changed `hex"600a"` to `hex"600c"` in SSTORE2.sol.
**Rule**: Always count actual opcode bytes before hardcoding offsets. PUSH1=2, PUSH2=3, not 1 and 2.

## Issue: Ganache vs EVM Versions
**What happened**: OpenZeppelin v5 requires Cancun (mcopy opcode). Ganache v7 only supports up to London/Merge.
**Fix**: Downgraded to OZ v4.9 and compiled with `evmVersion: "london"`.
**Rule**: Match your test environment's EVM support with your Solidity compiler target. For Ganache, use London. For Foundry, use latest.

## Issue: Stack Too Deep
**What happened**: Compilation failed with "stack too deep" on the SVG renderer due to many local variables.
**Fix**: Enabled `viaIR: true` in compiler settings.
**Rule**: For complex contracts with nested function calls and many locals, always enable viaIR with optimizer.

## Issue: SVG Rendering Gas for Large Canvases
**What happened**: `renderSVG` for 32x32 (1024 pixels) exceeded Ganache's eth_call gas limit.
**Context**: 8x8 renders fine (3,613 chars SVG), 16x16 also fine (13,481 chars). 32x32 would produce ~50K chars.
**Rule**: SVG rendering is a view function (free on mainnet with 30M gas limit), but test environments may have lower limits. Consider adding a "render by rows" function for very large canvases.

## Design Decision: No Compression in v1
**Reasoning**: RLE compression saves storage but adds gas cost to reads and rendering. With SSTORE2, raw data is already cheap enough, and the current collection default is `16x16` so payloads stay compact at `128 bytes`. Larger canvases still exist through custom minting, but they are not the default path.
**Rule**: Keep the public default simple and cheap. Add larger canvases only when there is a clear reason.

## Design Decision: Global Palette vs Per-Token
**Reasoning**: Global palette = 48 bytes stored once. Per-token palette = 48 bytes per mint. For 10K collection, saves 480KB of storage and ~500K gas per mint.
**Rule**: Shared constants should be stored once, not per-token.
