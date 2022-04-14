// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../utils/OtoCoPlugin.sol";

interface MultisigFactory {
    function createProxy(address singleton, bytes memory data) external returns (address proxy);
}

/**
 * Multisig
 */
contract Multisig is OtoCoPlugin {

    event MultisigAdded(uint256 indexed series, address multisig);
    event MultisigRemoved(uint256 indexed series, address multisig);

    address public gnosisMasterCopy;
    address public gnosisMultisigFactory;

    mapping(uint256 => address[]) multisigDeployed;

    constructor(
        address otocoMaster,
        address masterCopy,
        uint256[] memory prevIds,
        address[] memory prevMultisig
    ) OtoCoPlugin(otocoMaster) {
        gnosisMasterCopy = masterCopy;
        for (uint i = 0; i < prevIds.length; i++ ) {
            multisigDeployed[prevIds[i]].push(prevMultisig[i]);
            emit MultisigAdded(prevIds[i], prevMultisig[i]);
        }
    }

    function updateGnosisMasterCopy(address newAddress) public onlyOwner {
        gnosisMasterCopy = newAddress;
    }

    function updateGnosisMultisigFactory(address newAddress) public onlyOwner {
        gnosisMultisigFactory = newAddress;
    }

    function addPlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            bytes memory data
        ) = abi.decode(pluginData, (uint256, bytes));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        address proxy = MultisigFactory(gnosisMultisigFactory).createProxy(gnosisMasterCopy, data);
        multisigDeployed[seriesId].push(proxy);
        emit MultisigAdded(seriesId, proxy);
    }

    /**
    * Attaching a pre-existing multisig to the entity
    * @dev seriesId Series to remove token from
    * @dev newMultisig Multisig address to be attached
    *
    * @param pluginData Encoded parameters to create a new token.
     */
    function attachPlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            address newMultisig
        ) = abi.decode(pluginData, (uint256, address));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        multisigDeployed[seriesId].push(newMultisig);
        emit TokenAdded(seriesId, newMultisig);
    }

    function removePlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            uint256 toRemove
        ) = abi.decode(pluginData, (uint256, uint256));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        address multisigRemoved = multisigDeployed[seriesId][toRemove];
        // Copy last token to the removed slot
        multisigDeployed[seriesId][toRemove] = multisigDeployed[seriesId][multisigDeployed[seriesId].length - 1];
        // Remove the last token from array
        multisigDeployed[seriesId].pop();
        emit MultisigRemoved(seriesId, multisigRemoved);
    }

}