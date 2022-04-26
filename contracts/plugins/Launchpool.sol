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

    function sponsor() external view returns(address);
    function metadata() external view returns(string memory);
}

/**
 * Launchpool Factory
 */
contract Launchpool is OtoCoPlugin {
    
    // Launchpool creation and removal events
    event LaunchpoolCreated(uint256 indexed seriesId, address sponsor, address pool, string metadata);
    event LaunchpoolRemoved(uint256 indexed seriesId, address pool);

    // Management events
    event UpdatedPoolSource(address indexed newSource);
    event AddedCurveSource(address indexed newSource);
    
    // The source of launchpool to be deployed
    address private _poolSource;
    // The curve sources that could be used on launchpool
    address[] private _curveSources;

    // The assignment of launchpools to entities
    mapping(uint256 => address) public launchpoolDeployed;

    constructor(
        address payable otocoMaster,
        address poolSource,
        address curveSource,
        uint256[] memory prevIds,
        address[] memory prevLaunchpools
    ) OtoCoPlugin(otocoMaster) {
        _poolSource = poolSource;
        _curveSources.push(curveSource);
        for (uint i = 0; i < prevIds.length; i++ ) {
            launchpoolDeployed[prevIds[i]] = prevLaunchpools[i];
            PoolInterface pool = PoolInterface(launchpoolDeployed[prevIds[i]]);
            emit LaunchpoolCreated(prevIds[i], pool.sponsor(), prevLaunchpools[i], pool.metadata());
        }
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

    function addPlugin(uint256 seriesId, bytes calldata pluginData) onlySeriesOwner(seriesId) transferFees() public payable override {
        (
            address[] memory _allowedTokens,
            uint256[] memory _uintArgs,
            string memory _metadata,
            address _shares,
            uint16 _curve
        ) = abi.decode(pluginData, (address[], uint256[], string, address, uint16));
        address pool = Clones.clone(_poolSource);
        PoolInterface(pool).initialize(_allowedTokens, _uintArgs, _metadata, msg.sender, _shares, _curveSources[_curve]);
        launchpoolDeployed[seriesId] = pool;
        emit LaunchpoolCreated(seriesId, msg.sender, pool, _metadata);
    }

    function removePlugin(uint256 seriesId, bytes calldata pluginData) onlySeriesOwner(seriesId) transferFees() public payable override {
        // Remove the last token from array
        address pool = launchpoolDeployed[seriesId];
        launchpoolDeployed[seriesId] = address(0);
        emit LaunchpoolRemoved(seriesId, pool);
    }
}