// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/proxy/Clones.sol';

interface ISeriesToken {
  function initialize(string memory name, string memory symbol) external;
  function mint(address to, uint256 amount) external;
  function transferOwnership(address newOwner) external;
}

interface IOtoCoGovernor {
  function initialize(
    address _token, 
    address _firstManager, 
    address[] calldata _allowed, 
    uint256 _votingPeriod, 
    string calldata _contractName
  ) external;
}

/**
 * Tokenized LLCs factory plugin
 */
contract GovernorInitializer {

    /**
    * Create a new Gnovernor instance contract and return it.
    *
    * @dev governorInstance the token instance to be cloned
    * @param pluginData Encoded parameters to create a new token.
     */
    function setup(address governorInstance, bytes calldata pluginData) 
      public returns (address governorProxy, address tokenProxy) 
    {
      (
        // Token and Governor name
        string memory name,				
        // Token Symbol
        string memory symbol,			
        address[] memory allowedContracts,
        // [0] Manager address
        // [1] Token Source to be Cloned
        // [2..n] Member Addresses
        address[] memory addresses,
        // [0] Members size,
        // [1] Voting period in days
        // [2..n] Member shares 
        uint256[] memory settings				
      ) = abi.decode(pluginData, (string, string, address[], address[], uint256[]));
      
      bytes32 salt = 
        keccak256(abi.encode(msg.sender, pluginData));
      
      ISeriesToken newToken = 
        ISeriesToken(Clones.cloneDeterministic(addresses[1], salt));
      IOtoCoGovernor newGovernor = 
        IOtoCoGovernor(Clones.cloneDeterministic(governorInstance, salt));
      
      // Initialize token
      newToken.initialize(name, symbol);
      
      // Count the amount of members to assign balances
      uint256 index = settings[0];
      while (index > 0) {
      	// Members start at addresses index 2
      	// Shares start at settings index 2
        newToken.mint(addresses[index+1], settings[index+1]);
        --index;
      }
      // Transfer ownership of the token to Governor contract
      newToken.transferOwnership(address(newGovernor));
      // Initialize governor
      newGovernor.initialize(
        address(newToken), 
        addresses[0], 
        allowedContracts, 
        settings[1], 
        name
      );
      
      governorProxy = address(newGovernor);
      tokenProxy = address(newToken);
    }
}