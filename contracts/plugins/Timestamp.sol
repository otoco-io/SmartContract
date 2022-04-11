// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./OtoCoPlugin.sol";

/**
 * Master Registry Contract.
 */
contract Timestamp is OtoCoPlugin, Initializable, OwnableUpgradeable {

    event DocumentTimestamped(uint256 indexed tokenId, uint256 timestamp, string filename, string cid);

    // Upgradeable contract initializer
    function initialize(address payable _otocoMaster) external {
        __Ownable_init();
        otocoMaster = _otocoMaster;
    }

    /**
    * @notice Create a new timestamp for the entity. May only be called by the owner of the series.
    *
    * @param tokenId The series ID be updated.
    * @param filename The filename
    * @param cid The hash content to be added.
     */
    function addTimestamp(uint256 tokenId, string memory filename, string memory cid) public onlySeriesOwner(tokenId) {
        //DocumentEntry memory doc = DocumentEntry(value, block.timestamp);
        //timestamps[series].push(doc);
        emit DocumentTimestamped(tokenId, block.timestamp, filename, cid);
    }

}