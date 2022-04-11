// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../utils/IOtoCoMaster.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

abstract contract OtoCoPlugin is OwnableUpgradeable {

    // Reference to the OtoCo Master to transfer plugin cost
    IOtoCoMaster private otocoMaster;

    /**
     * Modifier to allow only series owners to change content.
     * @param tokenId The plugin index to update.
     */
    modifier onlySeriesOwner(uint256 tokenId) {
        require(otocoMaster.ownerOf(tokenId), "Not the series owner");
        _;
    }

    /**
     * Update OtoCoMaster contract address.
     * @param newOtocoMaster The new updated contract.
     */
    function updateOtocoMaster(address newOtocoMaster) public onlyOwner {
        otocoMaster = newOtocoMaster;
    }

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The new updated contract.
     */
    function addPlugin(bytes calldata pluginData) public virtual;
}