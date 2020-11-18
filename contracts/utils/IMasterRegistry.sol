// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.0;

interface IMasterRegistry {
    function setRecord(address series, uint8 key, address value) external;
}