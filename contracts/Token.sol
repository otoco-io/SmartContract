// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SeriesToken is ERC20 {
    uint8 _decimals;

    constructor(string memory name_, string memory symbol_, uint256 supply_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _mint(msg.sender, supply_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}