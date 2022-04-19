// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IOtoCoJurisdiction {
    function getSeriesNameFormatted (string calldata nameToFormat) external pure returns(string memory);
    function getJurisdictionName () external view returns(string memory);
    function getJurisdictionBadge () external view returns(string memory);
    function getJurisdictionGoldBadge () external view returns(string memory);
}