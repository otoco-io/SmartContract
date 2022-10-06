// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ISeriesURI {
    function tokenURI(uint256 tokenId, uint256 lastMigrated, string calldata externalUrl) external view returns (string memory);
}