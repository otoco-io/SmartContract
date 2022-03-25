// Load dependencies
const { expect } = require('chai');
const bs58 = require('bs58')
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const OtoCorp = artifacts.require('OtoCorp');
const MasterRegistryV2 = artifacts.require('MasterRegistryV2');
const Series = artifacts.require('Series');

// Return bytes32 hex string from base58 encoded ipfs hash,
// stripping leading 2 bytes from 34 byte IPFS hash
// Assume IPFS defaults: function:0x12=sha2, size:0x20=256 bits
// E.g. "QmNSUYVKDSvPUnRLKmuxk9diJ6yS96r1TrAXzjTiBcCLAL" -->
// "0x017dfd85d4f6cb4dcd715a88101f7b1f06cd1e009b2327a0809d01eb9c91f231"
function bytes32FromIpfs(ipfsHash) {
  const buffer = Buffer.from(bs58.decode(ipfsHash).slice(2), 'base64');
  return (
    '0x' + buffer.toString('hex')
  )
}


// Return base58 encoded ipfs hash from bytes32 hex string,
// E.g. "0x017dfd85d4f6cb4dcd715a88101f7b1f06cd1e009b2327a0809d01eb9c91f231"
// --> "QmNSUYVKDSvPUnRLKmuxk9diJ6yS96r1TrAXzjTiBcCLAL"
function ipfsFromBytes32(bytes32) {
  // Add our default ipfs values for first 2 bytes:
  // function:0x12=sha2, size:0x20=256 bits
  // and cut off leading "0x"
  const hashHex = "1220" + bytes32.slice(2)
  const hashBytes = Buffer.from(hashHex, "hex")
  const hashStr = bs58.encode(hashBytes)
  return hashStr
}

// Start test block
contract('Document Timestamp Test', (accounts) => {
  before(async function () {
    // Deploy Master Contract
    this.otocorpInstance = await OtoCorp.deployed();
    this.documentTimestamp = await MasterRegistryV2.deployed();
    // Create series
    await this.otocorpInstance.createSeries('First Entity');
  });

  it('Should Exist Company', async function () {
    this.entityAddress = await this.otocorpInstance.mySeries();
    let series = await Series.at(this.entityAddress.toString());
    expect(await series.owner()).to.equal(accounts[0]);
    expect(await series.getName()).to.equal('First Entity');
  });

  it('Create new timestamp for the company', async function () {
    // try {
    //const bytes = bytes32FromIpfs('QmNSUYVKDSvPUnRLKmuxk9diJ6yS96r1TrAXzjTiBcCLAL');
    //console.log('BYTES32: ', bytes)
    const res = await this.documentTimestamp.addTimestamp(this.entityAddress.toString(), 'test.pdf', 'QmNSUYVKDSvPUnRLKmuxk9diJ6yS96r1TrAXzjTiBcCLAL');
    console.log(res)
    // } catch (err) {
    //   expect(err.reason).to.be.equals('Error: Only Series Owner could deploy tokens');
    // }
  })

  it('Verify timestamp created for company', async function () {
    // try {
    // const timestamps = await this.documentTimestamp.getTimestamps(this.entityAddress.toString());
    let past = await this.documentTimestamp.getPastEvents('DocumentTimestamped', { filter: { series: this.entityAddress.toString() } });
    const hashes = past.map((e) => {
      console.log(e)
      return {
        hash: e.transactionHash,
        cid: e.returnValues.cid,
        filename: e.returnValues.filename,
        timestamp: new Date(parseInt(e.returnValues.timestamp) * 1000)
      }
    });
    console.log(hashes)
    //const bytes = ipfsFromBytes32('QmNSUYVKDSvPUnRLKmuxk9diJ6yS96r1TrAXzjTiBcCLAL');
    // } catch (err) {
    //   expect(err.reason).to.be.equals('Error: Only Series Owner could deploy tokens');
    // }
  })

  // it('Check for Factory Migrated Tokens', async function () {
  //   let factoryEvents = await this.factory.getPastEvents( 'TokenCreated', { fromBlock: 0, toBlock: 'latest' } );
  //   for (let ev of factoryEvents){
  //     expect(web3.utils.isAddress(ev.returnValues.series)).to.be.equals(true); 
  //     expect(web3.utils.isAddress(ev.returnValues.value)).to.be.equals(true);
  //   }
  //   expect(factoryEvents.length).to.be.above(0);
  // });

});