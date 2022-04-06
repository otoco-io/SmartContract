// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IMasterRegistry {
    function setRecord(address series, uint16 key, address value) external;
}