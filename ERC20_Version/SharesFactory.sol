// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "./SharesToken.sol";

contract SharesFactory {

    event NewTokenCreated(address _contract, address _owner, string _name);

    function deployToken(string memory name, string memory symbol, uint256 supply, address series) public payable {
        SharesToken newContract = new SharesToken(name, symbol, supply, msg.sender, series);
        newContract.transferOwnership(msg.sender);
        emit NewTokenCreated(address(newContract), newContract.owner(), name);
    }
    
}