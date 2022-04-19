// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../OtoCoPlugin.sol";

/**
 * Master Registry Contract.
 */
contract Timestamp is OtoCoPlugin {

    event DocumentTimestamped(uint256 indexed seriesId, uint256 timestamp, string filename, string cid);

    // Upgradeable contract initializer
    constructor (address payable otocoMaster) OtoCoPlugin(otocoMaster) {}

    /**
    * Create a new timestamp for the entity. May only be called by the owner of the series.
    *
    * @param seriesId The series ID be updated.
    * @param pluginData filename and cid of the document to be timestamped abi encoded.
     */
    function addPlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) enoughFees() payable override {
        (
            string memory filename,
            string memory cid
        ) = abi.decode(pluginData, (string, string));
        emit DocumentTimestamped(seriesId, block.timestamp, filename, cid);
    }

    function removePlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) enoughFees() payable override {
        require(false, "Timestamp: Remove elements are not possible on this plugin.");
    }

}