// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface ITestMarketplace {
    function buyListing(uint256 listingId) external payable;
}

contract MarketplaceReenteringBuyer is IERC721Receiver {
    ITestMarketplace public immutable market;

    uint256 public reenterListingId;
    uint256 public reenterValue;
    bool public attemptedReentry;
    bool public failedReentry;

    constructor(address market_) {
        market = ITestMarketplace(market_);
    }

    function attackBuy(
        uint256 listingId,
        uint256 reenterListingId_,
        uint256 reenterValue_
    ) external payable {
        reenterListingId = reenterListingId_;
        reenterValue = reenterValue_;
        market.buyListing{value: msg.value}(listingId);
        reenterListingId = 0;
        reenterValue = 0;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        if (reenterListingId != 0) {
            attemptedReentry = true;
            (bool ok,) = address(market).call{value: reenterValue}(
                abi.encodeWithSignature("buyListing(uint256)", reenterListingId)
            );
            if (!ok) {
                failedReentry = true;
            }
        }
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
