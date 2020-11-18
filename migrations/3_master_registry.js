const MasterRegistry = artifacts.require('MasterRegistry');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
  let previousData;
  let previousSeries = [];
  let previousTokens = [];
  if (network == 'main'){
    previousData = require('../migrations_data/tokens.main.json');
  } else {
    previousData = require('../migrations_data/tokens.ropsten.json');
  }
  previousData.forEach( data => {
    previousSeries.push(data[0]);
    previousTokens.push(data[1]);
  });
  const instance = await deployProxy(MasterRegistry, [previousSeries, previousTokens], { deployer });
  console.log('Deployed', instance.address);
};