// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../OtoCoPlugin.sol";

interface GnosisSafeProxyFactory {
    function createProxy(address singleton, bytes memory data) external returns (address proxy);
}

/**
 * Multisig
 */
contract Multisig is OtoCoPlugin {

    event MultisigAdded(uint256 indexed series, address multisig);
    event MultisigRemoved(uint256 indexed series, address multisig);

    address public gnosisMasterCopy;
    address public gnosisProxyFactory;

    mapping(uint256 => uint256) public multisigPerEntity;
    mapping(uint256 => address[]) public multisigDeployed;

    constructor(
        address payable otocoMaster,
        address masterCopy,
        address proxyFactory,
        uint256[] memory prevIds,
        address[] memory prevMultisig
    ) OtoCoPlugin(otocoMaster) {
        gnosisMasterCopy = masterCopy;
        gnosisProxyFactory = proxyFactory;
        for (uint i = 0; i < prevIds.length; i++ ) {
            multisigDeployed[prevIds[i]].push(prevMultisig[i]);
            multisigPerEntity[prevIds[i]]++;
            emit MultisigAdded(prevIds[i], prevMultisig[i]);
        }
    }

    function updateGnosisMasterCopy(address newAddress) public onlyOwner {
        gnosisMasterCopy = newAddress;
    }

    function updateGnosisProxyFactory(address newAddress) public onlyOwner {
        gnosisProxyFactory = newAddress;
    }

    function addPlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
        address proxy = GnosisSafeProxyFactory(gnosisProxyFactory).createProxy(gnosisMasterCopy, pluginData);
        multisigDeployed[seriesId].push(proxy);
        multisigPerEntity[seriesId]++;
        emit MultisigAdded(seriesId, proxy);
    }

    /**
    * Attaching a pre-existing multisig to the entity
    * @dev seriesId Series to remove token from
    * @dev newMultisig Multisig address to be attached
    *
    * @param pluginData Encoded parameters to create a new token.
     */
    function attachPlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
        (
            address newMultisig
        ) = abi.decode(pluginData, ( address));
        multisigDeployed[seriesId].push(newMultisig);
        multisigPerEntity[seriesId]++;
        emit MultisigAdded(seriesId, newMultisig);
    }

    function removePlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
        (
            uint256 toRemove
        ) = abi.decode(pluginData, (uint256));
        address multisigRemoved = multisigDeployed[seriesId][toRemove];
        // Copy last token to the removed slot
        multisigDeployed[seriesId][toRemove] = multisigDeployed[seriesId][multisigDeployed[seriesId].length - 1];
        // Remove the last token from array
        multisigDeployed[seriesId].pop();
        multisigPerEntity[seriesId]--;
        emit MultisigRemoved(seriesId, multisigRemoved);
    }

}