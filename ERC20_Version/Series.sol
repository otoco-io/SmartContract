// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.12;

import "github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol";

contract Series is Ownable {
  string name;
  mapping(address=>address[]) plugins;

  constructor(string memory _name) public {
    name = _name;
  }

  function getName() public view returns (string memory) {
    return name;
  }
}
