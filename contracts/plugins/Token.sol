// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/proxy/Clones.sol';
import "../utils/OtoCoToken.sol";
import "../utils/OtoCoPlugin.sol";

/**
 * Token factory plugin
 */
contract Token is OtoCoPlugin {

    event TokenAdded(uint256 indexed series, address token);
    event TokenRemoved(uint256 indexed series, address token);

    // Token source contract to be cloned
    address private tokenContract;
    // Mapping from entities to deployed tokens
    mapping(uint256 => address[]) tokensDeployed;

    constructor(
        address otocoMaster,
        address token,
        uint256[] memory prevIds,
        address[] memory prevTokens
    ) OtoCoPlugin(otocoMaster) {
        require(prevIds.length == prevTokens.length, 'Previous series size different than previous tokens size.');
        tokenContract = token;
        for (uint i = 0; i < prevIds.length; i++ ) {
            tokensDeployed[prevIds[i]].push(prevTokens[i]);
            emit TokenAdded(prevIds[i], prevTokens[i]);
        }
    }

    /**
    * Update token contract base source
    *
    * @param newAddress New token source to be used
     */
    function updateTokenContract(address newAddress) public onlyOwner {
        tokenContract = newAddress;
    }

    /**
    * Create a new timestamp for the entity. May only be called by the owner of the series.
    *
    * @param pluginData Encoded parameters to create a new token.
     */
    function addPlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            uint256 supply,
            string memory name,
            string memory symbol
        ) = abi.decode(pluginData, (uint256, uint256, string, string));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        address newToken = Clones.clone(tokenContract);
        SeriesToken(newToken).initialize(name, symbol, supply, msg.sender);
        tokensDeployed[seriesId].push(newToken);
        emit TokenAdded(seriesId, address(newToken));
    }

     /**
    * Attaching a pre-existing token to the entity
    * @dev seriesId Series to remove token from
    * @dev newToken Token address to be attached
    *
    * @param pluginData Encoded parameters to create a new token.
     */
    function attachPlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            address newToken
        ) = abi.decode(pluginData, (uint256, address));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        tokensDeployed[seriesId].push(newToken);
        emit TokenAdded(seriesId, newToken);
    }

    /**
    * Remove token from entity
    * @dev seriesId Series to remove token from
    * @dev toRemove Token index to be removed
    *
    * @param pluginData Encoded parameters to create a new token.
     */
    function removePlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            uint256 toRemove
        ) = abi.decode(pluginData, (uint256, uint256));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        address tokenRemoved = tokensDeployed[seriesId][toRemove];
        // Copy last token to the removed slot
        tokensDeployed[seriesId][toRemove] = tokensDeployed[seriesId][tokensDeployed[seriesId].length - 1];
        // Remove the last token from array
        tokensDeployed[seriesId].pop();
        emit TokenRemoved(seriesId, tokenRemoved);
    }
}