// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OtoCoToken is ERC20 {

    // Logged when the owner of a node assigns a new owner to a subnode.
    event Initialized(address member, uint timestamp);

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    // uint256 private _totalSupply;
    string private _name;
    string private _symbol;

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
        require(totalSupply() == 0, "OtoCoToken: Contract already initialized");
        _;
    }

    function initialize (string memory name_, string memory symbol_, uint256 supply_, address member_) public NotInitialized {
        _name = name_;
        _symbol = symbol_;
        _mint(member_, supply_);
        emit Initialized(member_, block.timestamp);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view override returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view override returns (string memory) {
        return _symbol;
    }
}