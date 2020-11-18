const GnosisSafe = artifacts.require('@gnosis.pm/safe-contracts/GnosisSafe');
const MultisigFactory = artifacts.require('MultisigFactory')

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
  let masterCopy = {};
  if (network == 'main'){
    masterCopy.address = '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F';
  } else {
    masterCopy = await deployer.deploy(GnosisSafe);
  }
  const factory = await deployProxy(MultisigFactory, [masterCopy.address], { deployer });
  console.log('Factory Deployed', factory.address);
};