// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const OtoCorp = artifacts.require('OtoCorp');
const Series = artifacts.require('Series');
const Token = artifacts.require('SeriesToken');
const TokenFactory = artifacts.require('TokenFactory');
var previousData = require('../migrations_data/tokens.ropsten.json') 

// Start test block
contract('Token Factory', (accounts) => {
  before(async function () {
    // Deploy token
    this.tokenInstance = await Token.deployed();
    // Deploy Master Contract
    this.otocorpInstance = await OtoCorp.deployed();
    // Create token Factory
    this.factory = await TokenFactory.deployed();
    console.log('FACTORY ADDRESS:',this.factory.address)
  });

  it('Check for Factory Owner', async function () {
    let owner = await this.factory.owner();
    expect(owner).to.equal(accounts[0]);
  });

  it('Check for Factory Migrated Tokens', async function () {
    let factoryEvents = await this.factory.getPastEvents( 'TokenCreated', { fromBlock: 0, toBlock: 'latest' } );
    for (let ev of factoryEvents){
      expect(web3.utils.isAddress(ev.returnValues.series)).to.be.equals(true); 
      expect(web3.utils.isAddress(ev.returnValues.value)).to.be.equals(true);
    }
    expect(factoryEvents.length).to.be.above(0);
  });

  it('Throws error trying to transfer ownership from not owner', async function () {
    try {
      await this.factory.transferOwnership(accounts[3], {from:accounts[2]});
    } catch (err) {
      expect(err.reason).to.be.equals('Ownable: caller is not the owner');
    }
  })

  it('Transfer Registry Ownership to Account[2]', async function () {
    await this.factory.transferOwnership(accounts[2]);
    let owner = await this.factory.owner();
    expect(owner).to.equal(accounts[2]);
  });

});