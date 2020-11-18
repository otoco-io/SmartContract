// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const OtoCorp = artifacts.require('OtoCorp');
const MasterRegistry = artifacts.require('MasterRegistry');
const Token = artifacts.require('SeriesToken');
const TokenFactory = artifacts.require('TokenFactory');

// Start test block
contract('Token Factory', (accounts) => {
  before(async function () {
    // Deploy token
    this.tokenInstance = await Token.deployed();
    // Deploy Master Contract
    this.otocorpInstance = await OtoCorp.deployed();
    // Create series
    await this.otocorpInstance.createSeries('First Entity', {from:accounts[1]});
    await this.otocorpInstance.createSeries('Second Entity', {from:accounts[2]});
    // Create token Factory
    this.factory = await TokenFactory.deployed();
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

  it('Check creating token from NOT SERIES OWNER', async function () {
    let seriesAddress = await this.otocorpInstance.mySeries({from:accounts[1]});
    try {
      await this.factory.createERC20(100000, 'Test Token', 'TTOK', seriesAddress[0]);
    } catch (err) {
      expect(err.reason).to.be.equals('Error: Only Series Owner could deploy tokens');
    }
  })

  it('Check creating token from SERIES OWNER', async function () {
    let registry = await MasterRegistry.deployed();
    let seriesAddress = await this.otocorpInstance.mySeries({from:accounts[1]});
    await this.factory.createERC20(100000, 'Test Token', 'TTOK', seriesAddress[0], {from:accounts[1]});
    let past = await this.factory.getPastEvents('TokenCreated', {filter:{series:seriesAddress[0]}});
    let tokenAddress = past[past.length-1].returnValues.value;
    past = await registry.getPastEvents('RecordChanged');
    let last = past[past.length-1];
    expect(last.returnValues.series).to.be.equals(seriesAddress[0]); 
    expect(last.returnValues.value).to.be.equals(tokenAddress); 
  })

  it('Throws error trying to transfer ownership from NOT OWNER', async function () {
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