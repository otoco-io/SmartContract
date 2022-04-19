// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../OtoCoJurisdiction.sol";

contract OtoCoUnincorporated is OtoCoJurisdiction {

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
        return name;
    }

}