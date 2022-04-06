// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "./utils/IMasterRegistry.sol";
import "./Token.sol";

contract TokenFactory is Initializable, OwnableUpgradeable {

    event TokenCreated(address indexed series, address value);

    address private _tokenContract; 
    address private _registryContract; 

    modifier onlySeriesOwner(address _series) {
        require(OwnableUpgradeable(_series).owner() == _msgSender(), "Error: Only Series Owner could deploy tokens");
        _;
    }

    function initialize(address token, address[] calldata previousSeries, address[] calldata previousTokens) external {
        require(previousSeries.length == previousTokens.length, 'Previous series size different than previous tokens size.');
        __Ownable_init();
        _tokenContract = token;
        for (uint i = 0; i < previousSeries.length; i++ ) {
            emit TokenCreated(previousSeries[i], previousTokens[i]);
        }
    }

    function updateTokenContract(address newAddress) onlyOwner public {
        _tokenContract = newAddress;
    }

    function updateRegistryContract(address newAddress) onlyOwner public {
        _registryContract = newAddress;
    }
    
    function createERC20(uint256 _supply, string memory _name, string memory _symbol, address _series) onlySeriesOwner(_series) public {
        SeriesToken newToken = SeriesToken(createClone(_tokenContract));
        newToken.initialize(_name, _symbol, _supply, msg.sender);
        if (_registryContract != address(0)){
            IMasterRegistry(_registryContract).setRecord(_series, 1, address(newToken));
        }
        emit TokenCreated(_series, address(newToken));
    }

    function createClone(address target) internal returns (address result) {
        bytes20 targetBytes = bytes20(target);
        assembly {
          let clone := mload(0x40)
          mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
          mstore(add(clone, 0x14), targetBytes)
          mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
          result := create(0, clone, 0x37)
        }
    }
}