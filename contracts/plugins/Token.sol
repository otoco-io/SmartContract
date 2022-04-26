// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/proxy/Clones.sol';
import "../OtoCoPlugin.sol";

interface ISeriesToken {
  function initialize (string memory name, string memory symbol, uint256 supply, address member) external;
}

/**
 * Token factory plugin
 */
contract Token is OtoCoPlugin {

    event TokenAdded(uint256 indexed series, address token);
    event TokenRemoved(uint256 indexed series, address token);

    // Token source contract to be cloned
    address public tokenContract;
    // Mapping from entities to deployed tokens
    mapping(uint256 => uint256) public tokensPerEntity;
    // Mapping from entities to deployed tokens
    mapping(uint256 => address[]) public tokensDeployed;


    /**
    * Constructor for Token Plugin.
    *
    * @param otocoMaster Address from the Master contract.
    * @param token Address from the token source contract to be cloned.
    * @param prevIds Previously deployed token series indexes.
    * @param prevTokens Addresses from the tokens previously deployed.
     */
    constructor(
        address payable otocoMaster,
        address token,
        uint256[] memory prevIds,
        address[] memory prevTokens
    ) OtoCoPlugin(otocoMaster) {
        require(prevIds.length == prevTokens.length, 'Previous series size different than previous tokens size.');
        tokenContract = token;
        for (uint i = 0; i < prevIds.length; i++ ) {
            tokensDeployed[prevIds[i]].push(prevTokens[i]);
            tokensPerEntity[prevIds[i]]++;
            emit TokenAdded(prevIds[i], prevTokens[i]);
        }
    }

    /**
    * Update token contract base source.
    *
    * @param newAddress New token source to be used
     */
    function updateTokenContract(address newAddress) public onlyOwner {
        tokenContract = newAddress;
    }

    /**
    * Create a new token for the entity. May only be called by the owner of the series.
    *
    * @param pluginData Encoded parameters to create a new token.
    * @dev seriesId would be the series that will own the token.
    * @dev supply the total supply of tokens to be issued.
    * @dev name the name of the token as string.
    * @dev symbol the symbol that respresent the token.
     */
    function addPlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
        (
            uint256 supply,
            string memory name,
            string memory symbol
        ) = abi.decode(pluginData, (uint256, string, string));
        address newToken = Clones.clone(tokenContract);
        ISeriesToken(newToken).initialize(name, symbol, supply, msg.sender);
        tokensDeployed[seriesId].push(newToken);
        tokensPerEntity[seriesId]++;
        emit TokenAdded(seriesId, newToken);
    }

    /**
    * Attaching a pre-existing token to the entity. May only be called by the entity owner.
    *
    * @param pluginData Encoded parameters to create a new token.
    * @dev seriesId Series to remove token from
    * @dev newToken Token address to be attached
     */
    function attachPlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
        (
            address newToken
        ) = abi.decode(pluginData, (address));
        tokensDeployed[seriesId].push(newToken);
        tokensPerEntity[seriesId]++;
        emit TokenAdded(seriesId, newToken);
    }

    /**
    * Remove token from entity
    *
    * @param pluginData Encoded parameters to create a new token.
    * @dev seriesId Series to remove token from
    * @dev toRemove Token index to be removed
     */
    function removePlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
        (
            uint256 toRemove
        ) = abi.decode(pluginData, (uint256));
        address tokenRemoved = tokensDeployed[seriesId][toRemove];
        // Copy last token to the removed slot
        tokensDeployed[seriesId][toRemove] = tokensDeployed[seriesId][tokensDeployed[seriesId].length - 1];
        // Remove the last token from array
        tokensDeployed[seriesId].pop();
        tokensPerEntity[seriesId]--;
        emit TokenRemoved(seriesId, tokenRemoved);
    }
}