const GnosisSafe = artifacts.require('@gnosis.pm/safe-contracts/GnosisSafe');
const MultisigFactory = artifacts.require('MultisigFactory')

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer) {
  await deployer.deploy(GnosisSafe);
  const safe = await GnosisSafe.deployed();
  const factory = await deployProxy(MultisigFactory, [safe.address], { deployer });
  console.log('Factory Deployed', factory.address);
};