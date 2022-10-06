// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IOtoCoJurisdiction.sol";

interface IOtoCoMasterV2 {

    struct Series {
        uint16 jurisdiction;
        uint16 entityType;
        uint64 creation;
        uint64 expiration;
        uint96 reserved;
        string name;
    }

    function series(uint256 tokenId) external view returns (Series calldata s);
    function jurisdictionAddress(uint16 jurisdiction) external view returns (IOtoCoJurisdiction j);
    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @dev See {OtoCoMaster-baseFee}.
     */
    function baseFee() external view returns (uint256 fee);

    receive() external payable;
}