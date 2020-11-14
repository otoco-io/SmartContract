// test/Box.proxy.test.js
// Load dependencies
const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
// Load compiled artifacts
const MasterRegistry = artifacts.require('MasterRegistry');
 
// Start test block
contract('MasterRegistry', (accounts) => {
  beforeEach(async function () {
    // Deploy a new Box contract for each test
    this.registry = await deployProxy(MasterRegistry);
  });
 
  // Test case
  it('retrieve returns a value previously initialized', async function () {
    const owner = await this.registry.owner();
    expect(owner).to.equal(accounts[0]);
  });
});