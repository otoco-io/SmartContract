const MasterRegistry = artifacts.require('MasterRegistry');
// const OtocoProxy = artifacts.require('OtocoProxy');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');


module.exports = async function (deployer, network, accounts) {
  const instance = await deployProxy(MasterRegistry, [], { deployer });
  console.log('Deployed', instance.address);
  
  // await deployer.deploy(MasterRegistry);
  // let masterRegistry = await MasterRegistry.deployed();
  // await deployer.deploy(OtocoProxy, masterRegistry.address);
  // let otocoProxy = await OtocoProxy.deployed();
  // let proxied = await MasterRegistry.at(otocoProxy.address);
  // proxied.initialize(accounts[0]);
};