// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IOtoCoMaster.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract OtoCoPlugin is Ownable {

    // Reference to the OtoCo Master to transfer plugin cost
    IOtoCoMaster public otocoMaster;

    /**
     * Modifier to allow only series owners to change content.
     * @param tokenId The plugin index to update.
     */
    function isSeriesOwner(uint256 tokenId) internal view returns (bool isOwner) {
        return otocoMaster.ownerOf(tokenId) == msg.sender;
    }

    constructor(address _otocoMaster) Ownable() {
        otocoMaster = IOtoCoMaster(_otocoMaster);
    }

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to create a new instance of plugin.
     */
    function addPlugin(bytes calldata pluginData) public payable virtual;

    /**
     * Allow attach a previously deployed plugin if possible 
     * @dev This function should run enumerous amounts of verifications before allow the attachment.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function attachPlugin(bytes calldata pluginData) public payable virtual;

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function removePlugin(bytes calldata pluginData) public payable virtual;
}