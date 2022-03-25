const MasterRegistry = artifacts.require('MasterRegistry');
const TokenFactory = artifacts.require('TokenFactory');
const Token = artifacts.require('SeriesToken');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
  let previousData;
  let previousSeries = [];
  let previousTokens = [];
  let token = await Token.deployed();
  const instance = await deployProxy(TokenFactory, [token.address, previousSeries, previousTokens], { deployer });
  console.log('Token Factory Address', instance.address);
  // Assing Registry and Factory
  let registry = await MasterRegistry.deployed();
  registry.setPluginController(1, instance.address);
  instance.updateRegistryContract(registry.address);
};