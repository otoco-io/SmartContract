// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./utils/IOtoCoMasterV2.sol";
import "./utils/IOtoCoPluginV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


abstract contract OtoCoPluginV2 is IOtoCoPluginV2, Ownable {

    // Custom errors
    /// @dev 0x82b42900
    error Unauthorized();
    /// @dev 0xdd4f4ace
    error AttachNotAllowed();
    /// @dev 0x713e7aee
    error RemoveNotAllowed();

    // Reference to the OtoCo Master to transfer plugin cost
    IOtoCoMasterV2 public otocoMaster;

    /**
     * Modifier to allow only series owners to change content or OtoCo Master itself.
     * @param tokenId The plugin index to update.
     */
    modifier onlySeriesOwner(uint256 tokenId) {
        if(
            msg.sender != address(otocoMaster) &&
            otocoMaster.ownerOf(tokenId) != msg.sender  
        ) revert Unauthorized();
        _;
    }

    /**
     * Modifier to check if the function set the correct amount of ETH value and transfer it to master.
     * If baseFee is 0 or sender is OtoCoMaster this step is jumped.
     * @dev in the future add/attach/remove could be called from OtoCo Master. In those cases no transfer should be called.
     */
    modifier transferFees() {
        if (
            otocoMaster.baseFee() > 0 && 
            msg.sender != address(otocoMaster)
        ) payable(otocoMaster).transfer(msg.value);
        _;
    }

    constructor(address payable _otocoMaster) Ownable() {
        otocoMaster = IOtoCoMasterV2(_otocoMaster);
    }

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     * @dev Override this function to implement your elements.
     * @param pluginData The parameters to create a new instance of plugin.
     */
    function addPlugin(uint256 seriesId, bytes calldata pluginData) external payable virtual override;

    /**
     * Allow attach a previously deployed plugin if possible
     * @dev This function should run enumerous amounts of verifications before allow the attachment.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     * @dev Override this function to implement your elements.
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function attachPlugin(uint256 seriesId, bytes calldata pluginData) external payable virtual override {
        revert AttachNotAllowed();
    }

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     * @dev Override this function to implement your elements.
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function removePlugin(uint256 seriesId, bytes calldata pluginData) external payable virtual override {
        revert RemoveNotAllowed();
    }
}