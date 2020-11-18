// Load dependencies
const { expect } = require('chai');
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
 
// Load compiled artifacts
const MasterRegistry = artifacts.require('MasterRegistry');
const MasterRegistryV2 = artifacts.require('MasterRegistryV2');
const OtoCorp = artifacts.require('OtoCorp');
const Series = artifacts.require('Series');
const Token = artifacts.require('SeriesToken');
var previousData = require('../migrations_data/tokens.ropsten.json') 

// Start test block
contract('MasterRegistry', async (accounts) => {
  before(async function () {
    // Deploy token
    this.tokenInstance = await Token.deployed();
    // Deploy Master Contract
    this.otocorpInstance = await OtoCorp.deployed();
    // Create series
    await this.otocorpInstance.createSeries('First Entity', {from:accounts[1]});
    await this.otocorpInstance.createSeries('Second Entity', {from:accounts[2]});
    // Create Master Registry
    this.registry = await MasterRegistry.deployed();
  });
 
  it('Should Exist First Company', async function () {
    let address = await this.otocorpInstance.mySeries({from:accounts[1]});
    let series = await Series.at(address.toString());
    expect(await series.owner()).to.equal(accounts[1]);
    expect(await series.getName()).to.equal('First Entity');
  });

  it('Should Exist Second Company', async function () {
    let address = await this.otocorpInstance.mySeries({from:accounts[2]});
    let series = await Series.at(address.toString());
    expect(await series.owner()).to.equal(accounts[2]);
    expect(await series.getName()).to.equal('Second Entity');
  });

  it('Check for Registry Owner', async function () {
    let owner = await this.registry.owner();
    expect(owner).to.equal(accounts[0]);
  });

  it('Check for Factory Migrated Tokens', async function () {
    let registryEvents = await this.registry.getPastEvents( 'RecordChanged', { fromBlock: 0, toBlock: 'latest' } );
    for (let ev of registryEvents){
      expect(web3.utils.isAddress(ev.returnValues.series)).to.be.equals(true); 
      expect(web3.utils.isAddress(ev.returnValues.value)).to.be.equals(true);
    }
    expect(registryEvents.length).to.be.above(0);
  });

  it('Set record from NOT SERIES OWNER', async function () {
    let series = await this.otocorpInstance.mySeries({from:accounts[1]});
    try {
      await this.registry.setRecord(series[0], 1, '0x0000000000000000000000000000000000000000', {from:accounts[2]});
    } catch (err) {
      expect(err.reason).to.be.equals('Not Authorized: Caller is not series owner, plugin or record itself');
    }
  })

  it('Set record from series owner', async function () {
    let series = await this.otocorpInstance.mySeries({from:accounts[1]});
    await this.registry.setRecord(series[0], 1, '0x0000000000000000000000000000000000000001', {from:accounts[1]});
    past = await this.registry.getPastEvents('RecordChanged');
    let last = past.pop();
    expect(last.returnValues.series).to.be.equals(series[0]); 
    expect(last.returnValues.value).to.be.equals('0x0000000000000000000000000000000000000001'); 
  });

  it('Set content from NOT SERIES OWNER', async function () {
    let series = await this.otocorpInstance.mySeries({from:accounts[1]});
    try {
      await this.registry.setContent(series[0], 1, 'this will not work...', {from:accounts[2]});
    } catch (err) {
      expect(err.reason).to.be.equals('Not Authorized: Caller is not series owner');
    }
  })

  it('Set content from series owner', async function () {
    let series = await this.otocorpInstance.mySeries({from:accounts[1]});
    await this.registry.setContent(series[0], 1, 'this will work!', {from:accounts[1]});
    past = await this.registry.getPastEvents('ContentChanged');
    let last = past.pop();
    expect(last.returnValues.series).to.be.equals(series[0]); 
    expect(last.returnValues.value).to.be.equals('this will work!'); 
  });

  it('Throws error trying to transfer ownership from not owner', async function () {
    try {
      await this.registry.transferOwnership(accounts[3], {from:accounts[2]});
    } catch (err) {
      expect(err.reason).to.be.equals('Ownable: caller is not the owner');
    }
  })

  it('Transfer Registry Ownership to Account[2]', async function () {
    await this.registry.transferOwnership(accounts[2]);
    let owner = await this.registry.owner();
    expect(owner).to.equal(accounts[2]);
  });

  it('Upgrade Master Registry and test new contract', async function () {
    const instance = await upgradeProxy(this.registry.address, MasterRegistryV2, {from: accounts[2]});
    expect(this.registry.address).to.be.equals(instance.address);
    let owner = await instance.owner();
    expect(owner).to.equal(accounts[2]);
    await instance.setTestVariable();
    let testVariable = web3.utils.BN(await instance.testVariable());
    expect(testVariable.toString()).to.equal('42');
  });

});