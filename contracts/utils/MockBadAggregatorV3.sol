// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract MockBadAggregatorV3 {

    int256 public price;
    uint256 public staleness;
    uint80 public roundIdValue;
    uint80 public answeredInRoundValue;
    uint256 public updatedAtValue;

    constructor() {
        price = 100000000000;
        staleness = 0;
        roundIdValue = 10;
        answeredInRoundValue = 10;
        updatedAtValue = block.timestamp;
    }

    function setPrice(int256 _price) external {
        price = _price;
    }

    function setStaleData(uint256 _staleness) external {
        staleness = _staleness;
    }

    function setRoundData(uint80 _roundId, uint80 _answeredInRound, uint256 _updatedAt) external {
        roundIdValue = _roundId;
        answeredInRoundValue = _answeredInRound;
        updatedAtValue = _updatedAt;
    }

    function latestRoundData()
    external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (
            roundIdValue,
            price,
            block.timestamp,
            staleness > 0 ? block.timestamp - staleness : updatedAtValue,
            answeredInRoundValue
        );
    }
}
