const OtoCorp = artifacts.require('OtoCorp');
const Token = artifacts.require('SeriesToken');

module.exports = async function (deployer, network, accounts) {
  if (network == 'main') return;
  await deployer.deploy(Token);
  let token = await Token.deployed();
  await deployer.deploy(OtoCorp, token.address);
  let instance = await OtoCorp.deployed();
  console.log('Otoco Master', instance.address);
};