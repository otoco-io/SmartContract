// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.0;

import "github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol";

contract Token {
    uint256 private _totalSupply;
    
    modifier NotInitialized() {
        require(_totalSupply == 0, "Error: Contract already initialized");
        _;
    }
    
    function initialize (string memory name, string memory symbol, uint256 supply, address member) NotInitialized public {}
}

contract TokenFactory is Ownable {

    mapping(address => address) public seriesToken;
    address private _tokenContract; 

    constructor(address token) public {
        _tokenContract = token;
    }
    
    modifier OnlySeriesOwner(address _series) {
        require(Ownable(_series).owner() == _msgSender(), "Error: Only Series Owner could deploy tokens");
        _;
    }

    function updateTokenContract(address newAddress) onlyOwner public {
        _tokenContract = newAddress;
    }
    
    function createERC20(uint256 _supply, string memory _name, string memory _symbol, address _series) OnlySeriesOwner(_series) public returns (address) {
        Token newToken = Token(createClone(_tokenContract));
        seriesToken[_series] = address(newToken);
        newToken.initialize(_name, _symbol, _supply, msg.sender);
        return address(newToken);
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