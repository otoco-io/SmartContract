// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "../OtoCoJurisdictionV2.sol";

contract JurisdictionUnaDunaV2 is OtoCoJurisdictionV2 {

    // Libraries
    using Strings for uint256;

    constructor (
        uint256 renewPrice,
        uint256 deployPrice,
        uint256 closePrice,
        string memory name,
        string memory defaultBadge,
        string memory goldBadge
    ) OtoCoJurisdictionV2(renewPrice, deployPrice, closePrice, name, defaultBadge, goldBadge, false) {}


    /**
     * @dev See {OtoCoJurisdiction-getSeriesNameFormatted}.
     */
    function getSeriesNameFormatted (
        uint256 count,
        string calldata nameToFormat
    ) public pure override returns(string memory){
        return string(abi.encodePacked(nameToFormat, ' Association'));
    }

}
