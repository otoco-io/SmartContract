// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./utils/IOtoCoMaster.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract OtoCoPlugin is Ownable {

    // Reference to the OtoCo Master to transfer plugin cost
    IOtoCoMaster public otocoMaster;

    /**
     * Modifier to allow only series owners to change content.
     * @param tokenId The plugin index to update.
     */
    modifier onlySeriesOwner(uint256 tokenId) {
        require(otocoMaster.ownerOf(tokenId) == msg.sender, "OtoCoPlugin: Not the entity owner.");
        _;
    }

    /**
     * Modifier to check if the function set the correct amount of ETH value and transfer it to master.
     */
    modifier enoughFees() {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        payable(otocoMaster).transfer(msg.value);
        _;
    }

    constructor(address payable _otocoMaster) Ownable() {
        otocoMaster = IOtoCoMaster(_otocoMaster);
    }

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to create a new instance of plugin.
     */
    function addPlugin(uint256 seriesId, bytes calldata pluginData) public payable virtual {}

    /**
     * Allow attach a previously deployed plugin if possible 
     * @dev This function should run enumerous amounts of verifications before allow the attachment.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function attachPlugin(uint256 seriesId, bytes calldata pluginData) public payable virtual {}

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function removePlugin(uint256 seriesId, bytes calldata pluginData) public payable virtual {}
}