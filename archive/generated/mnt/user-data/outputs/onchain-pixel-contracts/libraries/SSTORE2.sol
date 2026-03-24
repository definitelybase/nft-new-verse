// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SSTORE2
/// @notice Gas-efficient storage using contract bytecode
/// @dev Write: deploys a contract with data as bytecode (prefixed with STOP opcode)
///      Read: uses EXTCODECOPY to retrieve the data
///      Based on Solmate/Solady patterns
library SSTORE2 {
    // ============================================================
    //                        CUSTOM ERRORS
    // ============================================================

    error DeploymentFailed();
    error ReadOutOfBounds();
    error InvalidPointer();

    // We skip the first byte (STOP opcode 0x00) so contract can't be called
    uint256 private constant DATA_OFFSET = 1;

    // ============================================================
    //                        WRITE LOGIC
    // ============================================================

    /// @notice Stores `data` as contract bytecode and returns the pointer address
    /// @param data The data to store
    /// @return pointer The address of the deployed contract containing the data
    function write(bytes memory data) internal returns (address pointer) {
        // Prefix data with STOP opcode (0x00) to prevent the contract from being called
        bytes memory runtimeCode = abi.encodePacked(hex"00", data);
        uint256 runtimeSize = runtimeCode.length;

        // Creation code:
        // PUSH1 runtimeSize  [size]
        // DUP1               [size, size]
        // PUSH1 0x0a         [size, size, offset] (10 = creation code length)
        // PUSH1 0x00         [size, size, offset, destOffset]
        // CODECOPY            [size]  -- copies runtime code to memory
        // PUSH1 0x00         [size, 0]
        // RETURN             []      -- returns runtime code from memory

        bytes memory creationCode = abi.encodePacked(
            hex"61",                // PUSH2
            uint16(runtimeSize),    // size (2 bytes, supports up to 65535)
            hex"80"                 // DUP1
            hex"600a"               // PUSH1 0x0a (creation code = 10 bytes)
            hex"6000"               // PUSH1 0x00
            hex"39"                 // CODECOPY
            hex"6000"               // PUSH1 0x00
            hex"f3",                // RETURN
            runtimeCode
        );

        assembly {
            pointer := create(0, add(creationCode, 0x20), mload(creationCode))
        }

        if (pointer == address(0)) revert DeploymentFailed();
    }

    // ============================================================
    //                        READ LOGIC
    // ============================================================

    /// @notice Reads all data stored at `pointer`
    /// @param pointer The address of the contract containing the data
    /// @return data The stored data
    function read(address pointer) internal view returns (bytes memory data) {
        if (pointer.code.length == 0) revert InvalidPointer();

        uint256 size = pointer.code.length - DATA_OFFSET;

        assembly {
            // Allocate memory for the data
            data := mload(0x40)
            // Store length
            mstore(data, size)
            // Copy code (skip first byte = STOP opcode)
            extcodecopy(pointer, add(data, 0x20), DATA_OFFSET, size)
            // Update free memory pointer (round up to 32-byte boundary)
            mstore(0x40, add(add(data, 0x20), and(add(size, 0x1f), not(0x1f))))
        }
    }

    /// @notice Reads a slice of data stored at `pointer`
    /// @param pointer The address of the contract containing the data
    /// @param start Start offset (0-indexed, relative to data, not bytecode)
    /// @param end End offset (exclusive)
    /// @return data The sliced data
    function read(address pointer, uint256 start, uint256 end) 
        internal view returns (bytes memory data) 
    {
        uint256 codeSize = pointer.code.length;
        if (codeSize == 0) revert InvalidPointer();

        uint256 dataSize = codeSize - DATA_OFFSET;
        if (start > dataSize || end > dataSize || start > end) {
            revert ReadOutOfBounds();
        }

        uint256 size = end - start;

        assembly {
            data := mload(0x40)
            mstore(data, size)
            extcodecopy(
                pointer, 
                add(data, 0x20), 
                add(start, DATA_OFFSET), 
                size
            )
            mstore(0x40, add(add(data, 0x20), and(add(size, 0x1f), not(0x1f))))
        }
    }
}
