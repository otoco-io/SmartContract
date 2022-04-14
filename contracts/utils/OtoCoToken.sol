// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SeriesToken is ERC20 {

    // Logged when the owner of a node assigns a new owner to a subnode.
    event Initialized(address member, uint timestamp);

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    constructor() ERC20("", "") {}

    /**
     * @dev Sets the values for {name} and {symbol}, initializes {decimals} with
     * a default value of 18.
     *
     * To select a different value for {decimals}, use {_setupDecimals}.
     *
     * All three of these values are immutable: they can only be set once during
     * construction.
     */
    modifier NotInitialized() {
        require(_totalSupply == 0, "Error: Contract already initialized");
        _;
    }

    function initialize (string memory name, string memory symbol, uint256 supply, address member) public NotInitialized {
        _name = name;
        _symbol = symbol;
        _decimals = 18;
        _totalSupply = supply;
        _balances[member] = supply;
        emit Initialized(member, block.timestamp);
    }
}