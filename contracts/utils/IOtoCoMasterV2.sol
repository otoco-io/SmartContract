// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IOtoCoJurisdiction.sol";

interface IOtoCoMasterV2 {

    struct Series {
        uint16 jurisdiction;
        uint16 entityType;
        uint64 creation;
        uint64 expiration;
        string name;
    }

    function owner() external  view returns (address);

    function series(uint256 tokenId) external view returns (uint16, uint16, uint64, uint64, string memory);
    function jurisdictionAddress(uint16 jurisdiction) external view returns (IOtoCoJurisdiction j);
    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @dev See {OtoCoMaster-baseFee}.
     */
    function baseFee() external view returns (uint256 fee);
    function externalUrl() external view returns (string calldata);
    function getSeries(uint256 tokenId) external view returns (Series memory);
    receive() external payable;
    function docs(uint256 tokenId) external view returns(string memory);
}