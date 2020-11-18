const TokenFactory = artifacts.require('TokenFactory');
const Token = artifacts.require('SeriesToken');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
  let previousData;
  let previousSeries = [];
  let previousTokens = [];
  let tokenMasterCopy = {};
  if (network == 'main'){
    previousData = require('../migrations_data/tokens.main.json');
    tokenMasterCopy.address = '0x7b7B367ec9FA50a921acC4dbcedeA9CF39d9bF4d';
  } else {
    previousData = require('../migrations_data/tokens.ropsten.json');
    tokenMasterCopy = await deployer.deploy(Token);
  }
  previousData.forEach( data => {
    previousSeries.push(data[0]);
    previousTokens.push(data[1]);
  });
  const instance = await deployProxy(TokenFactory, [tokenMasterCopy.address, previousSeries, previousTokens], { deployer });
  console.log('Token Factory', instance.address);
};