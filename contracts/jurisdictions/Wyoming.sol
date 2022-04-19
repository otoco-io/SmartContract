// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "../OtoCoJurisdiction.sol";

contract OtoCoWyoming is OtoCoJurisdiction {

    // Libraries
    using Strings for uint256;

    constructor (
        string memory _name,
        string memory _defaultBadge,
        string memory _goldBadge
    ) OtoCoJurisdiction(_name, _defaultBadge, _goldBadge) {}

    /**
     * @dev See {OtoCoJurisdiction-getSeriesNameFormatted}.
     */
    function getSeriesNameFormatted (
        uint256 count,
        string memory name
    ) public pure override returns(string memory){
        return string(abi.encodePacked(name, ' - Series ', uint256(count+1).toString()));
    }

}