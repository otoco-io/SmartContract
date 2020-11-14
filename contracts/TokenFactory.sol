// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.0;

// import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

contract SeriesToken {
    function initialize (string memory name, string memory symbol, uint256 supply, address member) public {}
}

contract TokenFactory is OwnableUpgradeSafe {

    mapping(address => address) public seriesToken;
    address private _tokenContract; 

    constructor(address token) public {
        _tokenContract = token;
    }
    
    modifier OnlySeriesOwner(address _series) {
        require(OwnableUpgradeSafe(_series).owner() == _msgSender(), "Error: Only Series Owner could deploy tokens");
        _;
    }

    function updateTokenContract(address newAddress) onlyOwner public {
        _tokenContract = newAddress;
    }
    
    function createERC20(uint256 _supply, string memory _name, string memory _symbol, address _series) OnlySeriesOwner(_series) public returns (address) {
        SeriesToken newToken = SeriesToken(createClone(_tokenContract));
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