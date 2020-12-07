const MasterRegistry = artifacts.require('MasterRegistry');
const GnosisSafe = artifacts.require('@gnosis.pm/safe-contracts/GnosisSafe');
const MultisigFactory = artifacts.require('MultisigFactory')

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
  let masterCopy = {};
  if (network.substring(0,4) == 'main'){
    masterCopy.address = '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F';
  } else {
    await deployer.deploy(GnosisSafe);
    masterCopy = await GnosisSafe.deployed();
  }
  const factory = await deployProxy(MultisigFactory, [masterCopy.address], { deployer });
  console.log('Multisig Factory Address', factory.address);
  // Assing Registry and Factory
  let registry = await MasterRegistry.deployed();
  registry.setPluginController(2, factory.address);
  factory.updateRegistryContract(registry.address);
};