const MasterRegistry = artifacts.require('MasterRegistry');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
  let previousSeries = [];
  let previousTokens = [];
  const instance = await deployProxy(MasterRegistry, [previousSeries, previousTokens], { deployer });
  console.log('Master Registry Address', instance.address);
};
