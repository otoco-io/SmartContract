const ENSRegistrar = artifacts.require('ENSRegistrar');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const ENS = artifacts.require("@ensdomains/ens/ENSRegistry");
const FIFSRegistrar = artifacts.require('@ensdomains/ens/FIFSRegistrar');
const PublicResolver = artifacts.require('@ensdomains/resolver/PublicResolver');

// Currently the parameter('./ContractName') is only used to imply
// the compiled contract JSON file name. So even though `Registrar.sol` is
// not existed, it's valid to put it here.
// TODO: align the contract name with the source code file name.
const web3 = new (require('web3'))();
const namehash = require('eth-ens-namehash');

/**
 * Calculate root node hashes given the top level domain(tld)
 *
 * @param {string} tld plain text tld, for example: 'eth'
 */
function getRootNodeFromTLD(tld) {
  return {
    namehash: namehash.hash(tld),
    sha3: web3.utils.sha3(tld)
  };
}


/**
 * Deploy the ENS and FIFSRegistrar
 *
 * @param {Object} deployer truffle deployer helper
 * @param {string} tld tld which the FIFS registrar takes charge of
 */
async function deployFIFSRegistrar(deployer, tld) {
    var rootNode = getRootNodeFromTLD(tld);

    // Deploy the ENS first
    await deployer.deploy(ENS)
    .then(() => {
        // Deploy the FIFSRegistrar and bind it with ENS
        return deployer.deploy(FIFSRegistrar, ENS.address, rootNode.namehash);
    })
    .then(function() {
        // Transfer the owner of the `rootNode` to the FIFSRegistrar
        return ENS.at(ENS.address).then((c) => c.setSubnodeOwner('0x0', rootNode.sha3, FIFSRegistrar.address));
    });
}

module.exports = async function (deployer, network, accounts) {
  let previousData;
  let previousSeries = [];
  let previousDomains = [];
  let ensAddress;
  let resolverAddress;
  const rootNode = '0xd60cd0a683332ca8ad4a4d342320945cb769f25760b42a21f2d88d3be25cc6aa' // otoco.eth
  if (network == 'main'){
    previousData = require('../migrations_data/domains.main.json');
    ensAddress = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
    resolverAddress = '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41'
  } else if (network == 'ropsten'){
    previousData = require('../migrations_data/domains.ropsten.json');
    ensAddress = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
    resolverAddress = '0x42D63ae25990889E35F215bC95884039Ba354115';
  } else {
    previousData = require('../migrations_data/domains.ropsten.json');
    var tld = 'eth';
    await deployFIFSRegistrar(deployer, tld);
    ensAddress = ENS.address;
    await deployer.deploy(PublicResolver, ENS.address);
    resolverAddress = PublicResolver.address;
  }
  previousData.forEach( data => {
    previousDomains.push(web3.utils.utf8ToHex(data[0]));
    previousSeries.push(data[1]);
  });
  const instance = await deployProxy(ENSRegistrar, [ensAddress, resolverAddress, rootNode, previousSeries, previousDomains], { deployer });
  console.log('ENS Registrar Address', instance.address);
  if (network !== 'main' && network !== 'ropsten'){
    const FIFS = await FIFSRegistrar.deployed();
    FIFS.register(web3.utils.sha3('otoco'), instance.address)
  }
};