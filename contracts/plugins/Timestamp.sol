// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../utils/OtoCoPlugin.sol";

/**
 * Master Registry Contract.
 */
contract Timestamp is OtoCoPlugin {

    event DocumentTimestamped(uint256 indexed seriesId, uint256 timestamp, string filename, string cid);

    // Upgradeable contract initializer
    constructor (address otocoMaster) OtoCoPlugin(otocoMaster) {}

    /**
    * Create a new timestamp for the entity. May only be called by the owner of the series.
    *
    * @param seriesId The series ID be updated.
    * @param filename The filename
    * @param cid The hash content to be added.
     */
    function addPlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            string memory filename,
            string memory cid
        ) = abi.decode(pluginData, (uint256, string, string));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        emit DocumentTimestamped(seriesId, block.timestamp, filename, cid);
    }

    function removePlugin(bytes calldata pluginData) public payable override {
        require(false, "Timestamp: Remove elements are not possible on this plugin.");
    }

}