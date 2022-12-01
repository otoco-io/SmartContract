// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../OtoCoJurisdictionV2.sol";

contract JurisdictionDelawareV2 is OtoCoJurisdictionV2 {

    constructor (
        uint256 renewPrice,
        uint256 deployPrice,
        string memory name,
        string memory defaultBadge,
        string memory goldBadge
    ) OtoCoJurisdictionV2(renewPrice, deployPrice, name, defaultBadge, goldBadge) {}

    /**
     * @dev See {OtoCoJurisdiction-getSeriesNameFormatted}.
     */
    function getSeriesNameFormatted (
        uint256 count,
        string calldata nameToFormat
    ) public pure override returns(string memory){
        return string(abi.encodePacked(nameToFormat, ' LLC'));
    }

}