const OtoCorp = artifacts.require('OtoCorp');
const Token = artifacts.require('SeriesToken');

module.exports = async function (deployer, network, accounts) {
  if (network.substring(0,4) == 'main') return;
  await deployer.deploy(Token);
  let token = await Token.deployed();
  await token.initialize('Dai test', 'DAI', 100000000, accounts[0]);
  await deployer.deploy(OtoCorp, token.address);
  let instance = await OtoCorp.deployed();
  console.log('Otoco Master', instance.address);
};