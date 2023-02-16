// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./OtoCoMasterV2Mock.sol";

contract OtoCoMasterV2Test is OtoCoMasterV2Mock {
    constructor() {
        marketplaceAddress[msg.sender] = true;

        // create entity internally
        uint256 current = seriesCount;
        series[current] = Series(0, 1, uint64(block.timestamp), 1, "name");
        _mint(msg.sender, current);
        seriesCount++;
        seriesPerJurisdiction[0]++;
    }

    function testSanity() public returns (uint256 x, bool y) {
        uint256 x = priceFeedEth;
        bool y = marketplaceAddress[msg.sender];

        return (x, y);

        assert(x == 1 ether * (10**8));
        assert(y == true);
        assert(seriesPerJurisdiction[0] == 1);
        assert(seriesCount == 1);
        assert(ownerOf(0) == msg.sender);
    }

    function testZeroedOutFee()
        public
        payable
    {
        require(msg.value != 0);

        /* CONCRETE VALUES */
        uint256 periodInYears = 10;
        uint256 renewalPrice = 200;
        int256 conversion = 156060689252;

        // we replicate the logic implemented in `renewEntity()` to 
        // estimate the required total spin up price.
        uint256 val = (periodInYears / uint256(conversion)) * renewalPrice;
        if (msg.value < val)
            revert InsufficientValue({available: msg.value, required: val});

        /* ASSERTIONS */
        // `InsufficientValue` won't revert even if `msg.value` is zeroed out due
        // to `val` being an unintentional function invariant (i.e., := 0) .
        assert(msg.value >= val);
        assert(val == 0 && msg.value != 0);
    }
}
