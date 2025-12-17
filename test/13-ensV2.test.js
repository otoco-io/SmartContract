const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const utils = require('./utils');


const labelhash = (label) => ethers.utils.solidityKeccak256(['string'],[label])

describe("OtoCo ENSV2 Plugin Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster, otocoMaster, jurisdictions;
  let ensRegistry, ensPlugin, fifsRegistrar, publicResolver;
  let priceFeed;

  const zeroAddress = ethers.constants.AddressZero;

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    
    const unincorporated = await Unincorporated.deploy(0, 0, 0, 'DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy(0, 0, 0, 'DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy(0, 0, 0, 'WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address];
  });

  it("Initialize Master, add jurisdictions and create Series", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    OtoCoMaster = await ethers.getContractFactory("OtoCoMasterV2");
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    // Deploy and set price feed (required for V2)
    const PriceFeed = await ethers.getContractFactory("MockAggregatorV3");
    priceFeed = await PriceFeed.deploy();
    await otocoMaster.changePriceFeed(priceFeed.address);

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPayForSpinUp = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    // Expected to successfully create a new entity
    await otocoMaster.connect(wallet2).createSeries(2, wallet2.address, "New Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
    // Expect to create another entity
    await otocoMaster.connect(wallet3).createSeries(1, wallet3.address, "Another Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
  });

  it("Deploy External artifacts", async function () {
    
    const ENSRegistryArtifact = await utils.getExternalArtifact("ENSRegistry");
    const ENSRegistryFactory = await ethers.getContractFactoryFromArtifact(ENSRegistryArtifact);
    ensRegistry = await ENSRegistryFactory.deploy();
    
    const FIFSRegistrarArtifact = await utils.getExternalArtifact("FIFSRegistrar");
    const FIFSRegistrarFactory = await ethers.getContractFactoryFromArtifact(FIFSRegistrarArtifact);
    fifsRegistrar = await FIFSRegistrarFactory.deploy(ensRegistry.address, ethers.utils.namehash("eth"));

    const PublicResolverArtifact = await utils.getExternalArtifact("PublicResolver");
    const PublicResolverFactory = await ethers.getContractFactoryFromArtifact(PublicResolverArtifact);
    publicResolver = await PublicResolverFactory.deploy(ensRegistry.address, zeroAddress, zeroAddress, zeroAddress);

  });

  it("Setup ENS nodes and subnodes", async function () {
    const resolverNode = ethers.utils.namehash("resolver");
    const resolverLabel = labelhash("resolver");
    await ensRegistry.setSubnodeOwner(ethers.utils.formatBytes32String(''), resolverLabel, owner.address);
    await ensRegistry.setResolver(resolverNode, publicResolver.address);

    await ensRegistry.setOwner(ethers.utils.formatBytes32String(''), owner.address);
    
    expect(await ensRegistry.owner(ethers.utils.formatBytes32String(''))).to.be.equal(owner.address);
    
    await ensRegistry.setSubnodeOwner(ethers.utils.formatBytes32String(''), labelhash('eth'), fifsRegistrar.address);
    expect(await ensRegistry.owner(ethers.utils.namehash('eth'))).to.be.equals(fifsRegistrar.address)
  });

  it("Deploy ENS plugin and configure it", async function (){

    const rootNode = '0xd60cd0a683332ca8ad4a4d342320945cb769f25760b42a21f2d88d3be25cc6aa' // otoco.eth

    const ENSPluginFactory = await ethers.getContractFactory("ENSV2");
    // Migrate a first domain for the entity 0
    ensPlugin = await ENSPluginFactory.deploy(
        otocoMaster.address, ensRegistry.address, publicResolver.address, rootNode, [0], ['migrateddomain']
    );

    await fifsRegistrar.register(labelhash('otoco'), ensPlugin.address);
    expect(await ensRegistry.owner(ethers.utils.namehash('otoco.eth'))).to.be.equal(ensPlugin.address);
    expect(await ensRegistry.owner(ethers.utils.namehash('eth'))).to.be.equal(fifsRegistrar.address);

  });

  it("Add plugins and test duplication", async function (){
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("300000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'address'],
        ['somedomain', wallet2.address]
    );
    await ensPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});

    expect(await publicResolver.addr(ethers.utils.namehash('somedomain.otoco.eth'))).to.be.equals(wallet2.address);
    expect(await ensPlugin.domainsPerEntity(0)).to.be.equals(2);
    expect(await ensPlugin.seriesDomains(0,0)).to.be.equals('migrateddomain');
    expect(await ensPlugin.seriesDomains(0,1)).to.be.equals('somedomain');

    encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'address'],
        ['somedomain2', wallet2.address]
    );
    await ensPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});

    expect(await publicResolver.addr(ethers.utils.namehash('somedomain2.otoco.eth'))).to.be.equals(wallet2.address);
    expect(await ensPlugin.seriesDomains(0,2)).to.be.equals('somedomain2');

    await expect(ensPlugin.connect(wallet3).addPlugin(1, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(ensPlugin, 'InvalidDomain');

    encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'address'],
        ['willnotwork', wallet2.address]
    );
    await expect(ensPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(ensPlugin, 'Unauthorized');

    await expect(ensPlugin.connect(wallet3).addPlugin(1, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWithCustomError(otocoMaster, 'InsufficientValue');

  });

  it("test removed functions from plugin", async function (){
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("300000");
    const otocoBaseFee = await otocoMaster.baseFee();

    encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'address'],
        ['somedomain2', wallet2.address]
    );
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    await expect(ensPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(ensPlugin, 'AttachNotAllowed');

    await expect(ensPlugin.connect(wallet3).removePlugin(1, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(ensPlugin, 'RemoveNotAllowed');

  });

  it("Test migration in constructor", async function (){
    const rootNode = '0xd60cd0a683332ca8ad4a4d342320945cb769f25760b42a21f2d88d3be25cc6aa' // otoco.eth

    const ENSPluginFactory = await ethers.getContractFactory("ENSV2");
    
    // Test with multiple migrations
    const ensPluginWithMigrations = await ENSPluginFactory.deploy(
        otocoMaster.address, 
        ensRegistry.address, 
        publicResolver.address, 
        rootNode, 
        [0, 1, 1], 
        ['domain1', 'domain2', 'domain3']
    );

    // Verify migrations were applied
    expect(await ensPluginWithMigrations.domainsPerEntity(0)).to.be.equals(1);
    expect(await ensPluginWithMigrations.domainsPerEntity(1)).to.be.equals(2);
    expect(await ensPluginWithMigrations.seriesDomains(0, 0)).to.be.equals('domain1');
    expect(await ensPluginWithMigrations.seriesDomains(1, 0)).to.be.equals('domain2');
    expect(await ensPluginWithMigrations.seriesDomains(1, 1)).to.be.equals('domain3');
  });

});
