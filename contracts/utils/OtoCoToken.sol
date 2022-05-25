// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract OtoCoToken is ERC20, Initializable {

    // uint256 private _totalSupply;
    string private __name;
    string private __symbol;

    constructor() ERC20("", "") initializer {
    }

    function initialize (string memory name_, string memory symbol_, uint256 supply_, address member_) public initializer {
        __name = name_;
        __symbol = symbol_;
        _mint(member_, supply_);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view override returns (string memory) {
        return __name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view override returns (string memory) {
        return __symbol;
    }
}