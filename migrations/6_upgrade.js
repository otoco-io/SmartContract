const MasterRegistry = artifacts.require('MasterRegistry');
const MasterRegistryV2 = artifacts.require('MasterRegistryV2');
// const OtocoProxy = artifacts.require('OtocoProxy');
const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
    const existing = await MasterRegistry.deployed();
    const instance = await upgradeProxy(existing.address, MasterRegistryV2, { deployer });
    console.log("Upgraded", instance.address);
}