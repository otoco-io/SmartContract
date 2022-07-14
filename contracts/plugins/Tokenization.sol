// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/proxy/Clones.sol';
import "../OtoCoPlugin.sol";

interface ISeriesToken {
  function initialize (string memory name, string memory symbol) external;
  function mint(address to, uint256 amount) external;
  function transferOwnership(address newOwner) external;
}

interface IOtoCoGovernor {
  function initialize (address _token, address _firstManager, address[] calldata _allowed, uint256 _votingPeriod, string calldata _contractName) external;
}

/**
 * Tokenized LLCs factory plugin
 */
contract Tokenization is OtoCoPlugin {

    event Tokenized(uint256 indexed series, address dao);
    // DAO source contract to be cloned
    address public governorContract;
    // Mapping from entities to deployed tokens
    mapping(uint256 => address) public governorsDeployed;


    /**
    * Constructor for Token Plugin.
    *
    * @param otocoMaster Address from the Master contract.
    * @param governor Address from the governor source contract to be cloned.
     */
    constructor(
        address payable otocoMaster,
        address governor
    ) OtoCoPlugin(otocoMaster) {
        governorContract = governor;
    }
	/**
    * Update dao contract base source.
    *
    * @param newAddress New token source to be used
     */
    function updateGovernorContract(address newAddress) public onlyOwner {
        governorContract = newAddress;
    }


    /**
    * Create a new token for the entity. May only be called by the owner of the series.
    *
    * @dev seriesId would be the series that will own the token.
    * @param pluginData Encoded parameters to create a new token.
     */
    function addPlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
        (
            string memory name,				// Token and Governor name
            string memory symbol,			// Token Symbol
            address[] memory allowedContracts,
            // [0] Manager address
            // [1] Token Source
            // [2..n] Member Addresses
            address[] memory addresses,
            // [0] Allowed Contracts size,
            // [1] Members size,
            // [2] Voting period in days
            // [3..n] Member shares 
            uint256[] memory settings				
        ) = abi.decode(pluginData, (string, string, address[], address[], uint256[]));
        ISeriesToken newToken = ISeriesToken(Clones.clone(addresses[1]));
        IOtoCoGovernor newGovernor = IOtoCoGovernor(Clones.clone(governorContract));
		newToken.initialize(name, symbol);
		// Count the amount of members to assign balances
		uint256 index = settings[1];
        while (index > 0) {
        	// Members start at addresses index 2
        	// Shares start at settings index 3
        	newToken.mint(addresses[index+1], settings[index+2]);
        	--index;
        }
        // Transfer ownership of the token to Governor contract
        newToken.transferOwnership(address(newGovernor));
        // Initialize governor
        newGovernor.initialize(address(newToken), addresses[0], allowedContracts, settings[2], name);
        governorsDeployed[seriesId] = address(newGovernor);
        emit Tokenized(seriesId, address(newGovernor));
    }

    /**
    * Attaching a pre-existing token to the entity. May only be called by the entity owner.
    *
    * @param pluginData Encoded parameters to create a new token.
    * @dev seriesId Series to remove token from
    * @dev newToken Token address to be attached
     */
    // function attachPlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
    //     (
    //         address newToken
    //     ) = abi.decode(pluginData, (address));
    //     tokensDeployed[seriesId].push(newToken);
    //     tokensPerEntity[seriesId]++;
    //     emit TokenAdded(seriesId, newToken);
    // }

    /**
    * Remove token from entity
    *
    * @param pluginData Encoded parameters to create a new token.
    * @dev seriesId Series to remove token from
    * @dev toRemove Token index to be removed
     */
    // function removePlugin(uint256 seriesId, bytes calldata pluginData) public onlySeriesOwner(seriesId) transferFees() payable override {
    //     (
    //         uint256 toRemove
    //     ) = abi.decode(pluginData, (uint256));
    //     address tokenRemoved = tokensDeployed[seriesId][toRemove];
    //     // Copy last token to the removed slot
    //     tokensDeployed[seriesId][toRemove] = tokensDeployed[seriesId][tokensDeployed[seriesId].length - 1];
    //     // Remove the last token from array
    //     tokensDeployed[seriesId].pop();
    //     tokensPerEntity[seriesId]--;
    //     emit TokenRemoved(seriesId, tokenRemoved);
    // }
}