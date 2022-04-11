// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./OtoCoPlugin.sol";

/**
 * Master Registry Contract.
 */
contract Timestamp is OtoCoPlugin, Initializable, OwnableUpgradeable {

    event MultisigCreated(address indexed series, address value);

    address private _gnosisMasterCopy;

    function initialize(address payable otocoMaster, address masterCopy) external {
        __Ownable_init();
        _gnosisMasterCopy = masterCopy;
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

    modifier onlySeriesOwner(address _series) {
        require(OwnableUpgradeable(_series).owner() == _msgSender(), "Error: Only Series Owner could deploy tokens");
        _;
    }

    function updateGnosisMasterCopy(address newAddress) onlyOwner public {
        _gnosisMasterCopy = newAddress;
    }


    function createMultisig(address _series, bytes memory data) onlySeriesOwner(_series) public {
        // GnosisSafeProxy proxy = new GnosisSafeProxy(_gnosisMasterCopy);
        if (data.length > 0)
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                if eq(call(gas(), proxy, 0, add(data, 0x20), mload(data), 0, 0), 0) { revert(0,0) }
            }
        if (_registryContract != address(0)){
            IMasterRegistry(_registryContract).setRecord(_series, 2, address(proxy));
        }
        // emit MultisigCreated(_series, address(proxy));
    }

}