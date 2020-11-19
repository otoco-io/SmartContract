// Load dependencies
const { expect } = require('chai');

const OtoCorp = artifacts.require('OtoCorp');
const MasterRegistry = artifacts.require('MasterRegistry');
const GnosisSafe = artifacts.require('GnosisSafe');
const MultisigFactory = artifacts.require('MultisigFactory');

// Start test block
contract('Multisig Factory', (accounts) => {
  before(async function () {
    // Deployed token
    this.gnosisSafe = await GnosisSafe.deployed();
    // Deployed Master Contract
    this.otocorpInstance = await OtoCorp.deployed();
    // Create series
    await this.otocorpInstance.createSeries('First Entity', {from:accounts[1]});
    await this.otocorpInstance.createSeries('Second Entity', {from:accounts[2]});
    // Setup for Wallet configuration in Hex
    this.setupParametersEncoded = web3.eth.abi.encodeFunctionCall(
        GnosisSafe.abi[36],             // Abi for Initialize wallet with Owners config
        [[accounts[0], accounts[1]],    // Array of owners
        1,                              // Threshold
        '0x0000000000000000000000000000000000000000',
        '0x0',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        0,
        '0x0000000000000000000000000000000000000000'
    ]);
    // Creates Multisig Factory
    this.factory = await MultisigFactory.deployed();
  });

  it('Check for Factory Owner', async function () {
    let owner = await this.factory.owner();
    expect(owner).to.equal(accounts[0]);
  });

  it('Check creating wallet from NOT SERIES OWNER', async function () {
    let seriesAddress = await this.otocorpInstance.mySeries({from:accounts[1]});
    try {
      await this.factory.createMultisig(seriesAddress[0], this.setupParametersEncoded);
    } catch (err) {
      expect(err.reason).to.be.equals('Error: Only Series Owner could deploy tokens');
    }
  })

  it('Check creating wallet from SERIES OWNER', async function () {
    let registry = await MasterRegistry.deployed();
    let seriesAddress = await this.otocorpInstance.mySeries({from:accounts[1]});
    await this.factory.createMultisig(seriesAddress[0], this.setupParametersEncoded,  {from:accounts[1]});
    let past = await this.factory.getPastEvents('MultisigCreated', {filter:{series:seriesAddress[0]}});
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