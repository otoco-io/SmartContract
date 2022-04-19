// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../OtoCoPlugin.sol";
import '@openzeppelin/contracts/proxy/Clones.sol';

interface PoolInterface {
    function initialize(
        address[] memory allowedTokens,
        uint256[] memory uintArgs,
        string memory _metadata,
        address _sponsor,
        address _shares,
        address _curve
    ) external;
}

/**
 * Launchpool Factory
 */
contract LaunchpoolFactory is OtoCoPlugin {
    
    // Launchpool creation and removal events
    event LaunchpoolCreated(uint256 seriesId, address indexed sponsor, address pool, string metadata);
    event LaunchpoolRemoved(uint256 seriesId, address pool);

    // Management events
    event UpdatedPoolSource(address indexed newSource);
    event AddedCurveSource(address indexed newSource);
    event UpdatedRegistry(address indexed newAddress);
    
    // The source of launchpool to be deployed
    address private _poolSource;
    // The curve sources that could be used on launchpool
    address[] private _curveSources;

    // The assignment of launchpools to entities
    mapping(uint256 => address[]) launchpoolDeployed;

    constructor(address payable otocoMaster, address poolSource, address curveSource) OtoCoPlugin(otocoMaster) {
        _poolSource = poolSource;
        _curveSources.push(curveSource);
    }

    /**
    * Update launchpool Source
    *
    * @param newAddress The new launchpool source to be used on clones
     */
    function updatePoolSource(address newAddress) public onlyOwner {
        _poolSource = newAddress;
        emit UpdatedPoolSource(newAddress);
    }

    /**
    * Add a new curve source to the curve options
    *
    * @param newAddress The new curve source to be added to curve options
     */
    function addCurveSource(address newAddress) public onlyOwner {
        _curveSources.push(newAddress);
        emit AddedCurveSource(newAddress);
    }

    function addPlugin(uint256 seriesId, bytes calldata pluginData) onlySeriesOwner(seriesId) enoughFees() public payable override {
        (
            address[] memory _allowedTokens,
            uint256[] memory _uintArgs,
            string memory _metadata,
            address _shares,
            uint16 _curve
        ) = abi.decode(pluginData, (address[], uint256[], string, address, uint16));
        address pool = Clones.clone(_poolSource);
        PoolInterface(pool).initialize(_allowedTokens, _uintArgs, _metadata, msg.sender, _shares, _curveSources[_curve]);
        launchpoolDeployed[seriesId].push(pool);
        emit LaunchpoolCreated(seriesId, msg.sender, pool, _metadata);
    }

    function removePlugin(uint256 seriesId, bytes calldata pluginData) onlySeriesOwner(seriesId) enoughFees() public payable override {
        (
            uint256 toRemove
        ) = abi.decode(pluginData, (uint256));
        address poolRemoved = launchpoolDeployed[seriesId][toRemove];
        // Copy last token to the removed slot
        launchpoolDeployed[seriesId][toRemove] = launchpoolDeployed[seriesId][launchpoolDeployed[seriesId].length - 1];
        // Remove the last token from array
        launchpoolDeployed[seriesId].pop();
        emit LaunchpoolRemoved(seriesId, poolRemoved);
    }
}