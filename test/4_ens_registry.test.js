// Load dependencies
const { expect } = require('chai');
const namehash = require('eth-ens-namehash');
 
// Load compiled artifacts
const ENSRegistrar = artifacts.require('ENSRegistrar');
const OtoCorp = artifacts.require('OtoCorp');
const Series = artifacts.require('Series');
const PublicResolver = artifacts.require('@ensdomains/resolver/PublicResolver');

// Start test block
contract('ENS Registry', async (accounts) => {
  before(async function () {
    // Deployed Master Contract
    this.otocorpInstance = await OtoCorp.deployed();
    // Create series
    await this.otocorpInstance.createSeries('Third Entity', {from:accounts[3]});
    // Get registrar registry
    this.registrar = await ENSRegistrar.deployed();
  });
 
  it('Should Exist Third Company', async function () {
    let address = await this.otocorpInstance.mySeries({from:accounts[3]});
    let series = await Series.at(address.toString());
    expect(await series.owner()).to.equal(accounts[3]);
    expect(await series.getName()).to.equal('Third Entity');
  });

  it('Check for ENS Migrated Domains', async function () {
    let registrarEvents = await this.registrar.getPastEvents( 'NameClaimed', { fromBlock: 0, toBlock: 'latest' } );
    for (let ev of registrarEvents){
      expect(web3.utils.isAddress(ev.returnValues.series)).to.be.equals(true); 
      console.log('Domain registered >>>', ev.returnValues.value, '<<<')
    }
    expect(registrarEvents.length).to.be.above(0);
  });

  it('Set new domain for third series', async function () {
    let series = await this.otocorpInstance.mySeries({from:accounts[3]});
    await this.registrar.registerAndStore('thirdentity', series[0], accounts[3], {from:accounts[3]});
    const domainsCount = await this.registrar.ownedDomains(series[0]);
    const firstDomain = await this.registrar.resolve(series[0], 0);
    expect(domainsCount.toString()).to.be.equals('1');
    expect(firstDomain).to.be.equals('thirdentity');
  })

  it('Check public resolver appointment to addr', async function () {
    let resolver = await PublicResolver.deployed()
    let addr = await resolver.addr(namehash.hash('thirdentity.otoco.eth'));
    expect(addr).to.be.equals(accounts[3]);
  })

});