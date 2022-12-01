// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract MockAggregatorV3 {

    int256 lastPrice;

    constructor() {
        lastPrice = 100000000000;
    }

    /**
     * Get the tokenURI that points to a SVG image.
     * Returns the svg formatted accordingly.
     */
    function latestRoundData()
    external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (
            10,
            lastPrice, // 1000 USD fixed value
            100000,
            100000,
            100
        );
    }
}