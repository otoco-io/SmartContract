const MasterRegistry = artifacts.require('MasterRegistry');
 
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer) {
  const instance = await deployProxy(MasterRegistry, [], { deployer });
  console.log('Deployed Master', instance.address);
};