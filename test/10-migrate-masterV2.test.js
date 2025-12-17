const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const crypto = require('crypto');

const EthDividend = ethers.BigNumber.from(ethers.utils.parseUnits('1', 18)).mul(ethers.utils.parseUnits('1', 9)).div(10);

describe("OtoCo Master Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let priceFeed;

  const zeroAddress = ethers.constants.AddressZero;

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const Swiss = await ethers.getContractFactory("JurisdictionSwissAssociationV2");
    
    const unincorporated = await Unincorporated.deploy(100, 2, 0, 'DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy(5, 5, 10, 'DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy(50, 40, 150000, 'WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');
    const swiss = await Swiss.deploy(10, 10, 10, 'SWISS', 'defaultBadgeURLSA', 'goldBadgeURLSA');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address, swiss.address];
  });

  it("Initialize Master and add jurisdictions", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
  });

  it("Check jurisdiction order and count", async function () {

    const unincorporated = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(0));
    const delaware = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(1));
    const wyoming = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(2));
    const swiss = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(3));

    expect(await otocoMaster.jurisdictionCount()).to.equal(4);

    expect(await unincorporated.getJurisdictionName()).to.equal("DAO");
    expect(await delaware.getJurisdictionName()).to.equal("DELAWARE");
    expect(await wyoming.getJurisdictionName()).to.equal("WYOMING");
    expect(await swiss.getJurisdictionName()).to.equal("SWISS");

  });

  it("Test migration of previous entities", async function () {

    const jurisdictions = [0,1,2];
    const controllers = [wallet2.address, wallet3.address, wallet4.address];
    const creations = [10000, 20000, 30000];
    const names = ['Entity 1', 'Entity 2 LLC', 'Entity 3 - Series 1'];

    await otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names);

    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(3);

    const firstSeries = await otocoMaster.series(0);
    expect(firstSeries[0]).to.equal(0);
    expect(firstSeries[2].toNumber()).to.equal(10000);
    expect(firstSeries[3]).to.equal("Entity 1");

    const secondSeries = await otocoMaster.series(1);
    expect(secondSeries[0]).to.equal(1);
    expect(secondSeries[2].toNumber()).to.equal(20000);
    expect(secondSeries[3]).to.equal("Entity 2 LLC");

  });

  it("Test migration entities", async function () {

    const jurisdictions = [2,2,2,1];
    const controllers = [wallet2.address, wallet3.address, wallet4.address, zeroAddress];
    const creations = [10000, 20000, 30000, 40000];
    const names = ['Entity 1 - Series 2', 'Entity 2 - Series 3', 'Entity 3 - Series 4', 'Closed LLC'];

    await otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names);

    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(7);

    const firstSeries = await otocoMaster.series(3);
    expect(firstSeries[0]).to.equal(2);
    expect(firstSeries[2].toNumber()).to.equal(10000);
    expect(firstSeries[3]).to.equal("Entity 1 - Series 2");

    const secondSeries = await otocoMaster.series(4);
    expect(secondSeries[0]).to.equal(2);
    expect(secondSeries[2].toNumber()).to.equal(20000);
    expect(secondSeries[3]).to.equal("Entity 2 - Series 3");

  });

  it("Update Master contract to V2", async function () {

    const OtoCoMasterV2 = await ethers.getContractFactory("OtoCoMasterV2");
    otocoMaster = await upgrades.upgradeProxy(otocoMaster.address, OtoCoMasterV2);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
  });

  it("Change payment fees and price feed source", async function () {
    
    const otocoBaseFee = await otocoMaster.baseFee();
    expect(await otocoMaster.changeBaseFees("5000000000000000"))
    .to.emit(otocoMaster, "BaseFeeChanged")
    .withArgs("5000000000000000");
    expect(await otocoMaster.baseFee()).to.be.equal("5000000000000000");
    const PriceFeed = await ethers.getContractFactory("MockAggregatorV3");
    priceFeed = await PriceFeed.deploy();
    expect(await otocoMaster.changePriceFeed(priceFeed.address)).to.emit(otocoMaster, "UpdatedPriceFeed");

  });

  it("Creating series with correct fees and wrong fees", async function () {

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");
    // Check the amount of ETH has to be paid after pass the priceFeed
    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const Swiss = await ethers.getContractFactory("JurisdictionSwissAssociationV2");
    const unc = Unincorporated.attach(await otocoMaster.jurisdictionAddress(0));
    const de = Delaware.attach(await otocoMaster.jurisdictionAddress(1));
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    const swiss = Swiss.attach(await otocoMaster.jurisdictionAddress(3));
    const renewalPrices = [
      await wy.callStatic.getJurisdictionRenewalPrice(), 
      await de.callStatic.getJurisdictionRenewalPrice(),
      await unc.callStatic.getJurisdictionRenewalPrice(),
      await swiss.callStatic.getJurisdictionRenewalPrice(),
    ];
    const amountToPayForSpinUp = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await wy.getJurisdictionDeployPrice());
    const amountToPayForSpinUp2 = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await de.getJurisdictionDeployPrice());
    const amountToPayForSpinUp3 = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await unc.getJurisdictionDeployPrice());
    const amountToPayForSpinUp4 = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await swiss.getJurisdictionDeployPrice());
    const totalFeePaid = amountToPayForSpinUp.add(amountToPayForSpinUp2.add(amountToPayForSpinUp3).add(amountToPayForSpinUp4));
    // Remove 1% from the correct amount needed
    const notEnoughToPayForSpinUp = amountToPayForSpinUp.mul(100).div(101);

    // Try to create without the proper amount of ETH Value, expect to fail
    await expect(otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:notEnoughToPayForSpinUp}))
    .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

    const previousBalance = await ethers.provider.getBalance(otocoMaster.address);

    // Expected to successfully create a new entity
    const transaction = await otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
    const transaction2 = await otocoMaster.createSeries(1, owner.address, "New Entity 2", {gasPrice, gasLimit, value:amountToPayForSpinUp2});
    const transaction3 = await otocoMaster.createSeries(0, owner.address, "New Entity 3", {gasPrice, gasLimit, value:amountToPayForSpinUp3});
    const transaction4 = await otocoMaster.createSeries(3, owner.address, "New Entity 4", {gasPrice, gasLimit, value:amountToPayForSpinUp4});
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 7);
    await expect(transaction2).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 8);
    await expect(transaction3).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 9);
    await expect(transaction4).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 10);
    expect((await otocoMaster.series(7)).jurisdiction).to.be.equal(2);
    expect((await otocoMaster.series(8)).jurisdiction).to.be.equal(1);
    expect((await otocoMaster.series(9)).jurisdiction).to.be.equal(0);
    expect((await otocoMaster.series(10)).jurisdiction).to.be.equal(3);
    expect((await otocoMaster.series(7)).name).to.be.equal("New Entity - Series 5");
    expect((await otocoMaster.series(8)).name).to.be.equal("New Entity 2 LLC");
    expect((await otocoMaster.series(9)).name).to.be.equal("New Entity 3");
    expect((await otocoMaster.series(10)).name).to.be.equal("New Entity 4 Association");
    expect(renewalPrices[0]).to.eq(ethers.BigNumber.from(50));
    expect(renewalPrices[1]).to.eq(ethers.BigNumber.from(5));
    expect(renewalPrices[2]).to.eq(ethers.BigNumber.from(100));
    expect(renewalPrices[3]).to.eq(ethers.BigNumber.from(10));
    
    // Check if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(previousBalance.add(totalFeePaid));

  });

  it("Closing series with correct fees and wrong fees", async function () {

    // const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("60000");
    const otocoBaseFee = await otocoMaster.baseFee();

    // 34750 reduction from gas limit is what is spended before check happens
    const amountToPayForClose = ethers.BigNumber.from(gasLimit).sub(30000).mul(otocoBaseFee);
    // Remove 1% from the correct amount needed
    const notEnoughToPayForClose = amountToPayForClose.mul(100).div(110);

    await expect(otocoMaster.closeSeries(7, {/* gasPrice, gasLimit, */ value:notEnoughToPayForClose}))
    .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue")

    await expect(otocoMaster.connect(wallet2).closeSeries(7, {/* gasPrice, gasLimit, */ value:amountToPayForClose}))
    .to.be.revertedWithCustomError(otocoMaster, 'IncorrectOwner');

    // Close the company
    const transactionClose = await otocoMaster.closeSeries(7, {/* gasPrice, gasLimit,  */value:amountToPayForClose});
    await expect(transactionClose).to.emit(otocoMaster, 'Transfer').withArgs(owner.address, zeroAddress, 7);

    await expect(otocoMaster.ownerOf(6)).to.be.reverted;

    // test enoughAmountFees modifier
    const val = (await otocoMaster.callStatic.baseFee()).mul(ethers.constants.Two);
    await expect(ethers.provider.call(
      {to:otocoMaster.address, value:val }
    )).to.be.ok;

  });

  it("Should withdraw fees", async function () {

    // Try update with wrong wallet
    await expect(otocoMaster.connect(wallet2).withdrawFees())
    .to.be.revertedWith('Ownable: caller is not the owner');

    await otocoMaster.withdrawFees();
    
    // Check if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(0);

  });

  it("Deploy OtoCoURI with network prefix and update URI Sources", async function () {

    const EntityURI = await ethers.getContractFactory("OtoCoURI");
    const entityURI = await EntityURI.deploy(otocoMaster.address, "ethereum");
    await entityURI.deployed();

    // Test that only owner can change URI sources
    await expect(otocoMaster.connect(wallet3).changeURISources(entityURI.address))
      .to.be.revertedWith('Ownable: caller is not the owner');

    // Change URI source and verify event emission
    expect(await otocoMaster.changeURISources(entityURI.address))
      .to.emit(otocoMaster, "ChangedURISource")
      .withArgs(entityURI.address);

    // Verify the URI source was updated
    expect(await otocoMaster.entitiesURI()).to.be.equals(entityURI.address);
  });

  it("Check OtoCoURI tokenURI format with network prefix", async function () {

    const tokenURI = await otocoMaster.tokenURI(4);
    const tokenURI2 = await otocoMaster.tokenURI(7);

    // Verify URI starts with correct data URL scheme
    expect(tokenURI).to.include('data:application/json;base64,');
    expect(tokenURI2).to.include('data:application/json;base64,');

    // Decode base64 data to read JSON data
    let buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));

    // Verify migrated entity (tokenId < lastMigrated) has gold badge
    expect(json.name).to.be.equal("Entity 2 - Series 3");
    expect(json.image).to.be.equal("goldBadgeURLWY");
    expect(json.description).to.include("OtoCo NFTs are minted to represent each entity");
    expect(json.description).to.include("Entity 2 - Series 3");
    expect(json.description).to.include("https://otoco.io");
    
    // Verify external_url includes network prefix
    expect(json.external_url).to.include("https://otoco.io/dashpanel/entity/");
    expect(json.external_url).to.include("ethereum:4");

    // Verify attributes array structure
    expect(json.attributes).to.be.an('array');
    expect(json.attributes).to.have.lengthOf(2);

    // Verify creation date attribute
    expect(json.attributes[0].display_type).to.be.equal("date");
    expect(json.attributes[0].trait_type).to.be.equal("Creation");
    expect(json.attributes[0].value).to.be.equal("20000");

    // Verify jurisdiction attribute
    expect(json.attributes[1].trait_type).to.be.equal("Jurisdiction");
    expect(json.attributes[1].value).to.be.equals("WYOMING");

    // Verify docs field is not present when not set
    expect(json.docs).to.be.undefined;

    // Decode base64 data for newly created entity
    buff = Buffer.from(tokenURI2.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));

    // Verify new entity (tokenId >= lastMigrated) has default badge
    expect(json.name).to.be.equal("New Entity - Series 5");
    expect(json.image).to.be.equal("defaultBadgeURLWY");
    expect(json.external_url).to.include("ethereum:7");
    expect(json.attributes[0].trait_type).to.be.equal("Creation");
    expect(parseInt(json.attributes[0].value)).to.be.above(Date.now() * 0.0001 - 5000);
    expect(json.attributes[1].trait_type).to.be.equal("Jurisdiction");
    expect(json.attributes[1].value).to.be.equals("WYOMING");
  });

  it("Check OtoCoURI with different jurisdictions", async function () {

    // Test entity with Unincorporated jurisdiction (index 0)
    const tokenURI0 = await otocoMaster.tokenURI(0);
    let buff = Buffer.from(tokenURI0.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));

    expect(json.name).to.be.equal("Entity 1");
    expect(json.image).to.be.equal("goldBadgeURL"); // Unincorporated gold badge
    expect(json.attributes[1].value).to.be.equals("DAO");
    expect(json.external_url).to.include("ethereum:0");

    // Test entity with Delaware jurisdiction (index 1)
    const tokenURI1 = await otocoMaster.tokenURI(1);
    buff = Buffer.from(tokenURI1.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));

    expect(json.name).to.be.equal("Entity 2 LLC");
    expect(json.image).to.be.equal("goldBadgeURLDE"); // Delaware gold badge
    expect(json.attributes[1].value).to.be.equals("DELAWARE");
    expect(json.external_url).to.include("ethereum:1");

    // Test entity with Wyoming jurisdiction (index 2)
    const tokenURI2 = await otocoMaster.tokenURI(2);
    buff = Buffer.from(tokenURI2.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));

    expect(json.name).to.be.equal("Entity 3 - Series 1");
    expect(json.image).to.be.equal("goldBadgeURLWY"); // Wyoming gold badge
    expect(json.attributes[1].value).to.be.equals("WYOMING");
    expect(json.external_url).to.include("ethereum:2");
  });

  it("Check OtoCoURI with docs metadata", async function () {

    // Create docs metadata
    const cid = crypto.randomBytes(32).toString('hex');
    const docsJson = {
      LitCID: cid,
      Description: "Decrypt the CID with LitProtocol to access Entity documentation.",
    };

    // Only token owner can set docs
    await expect(otocoMaster.connect(wallet2).setDocs(4, JSON.stringify(docsJson)))
      .to.be.revertedWithCustomError(otocoMaster, "IncorrectOwner");

    // Set docs for entity 4 (owned by wallet3)
    const tx = await otocoMaster.connect(wallet3).setDocs(4, JSON.stringify(docsJson));

    // Verify event emission
    expect(tx).to.emit(otocoMaster, "DocsUpdated").withArgs(4);

    // Get updated tokenURI
    const tokenURI = await otocoMaster.tokenURI(4);
    const buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    const json = JSON.parse(buff.toString('utf-8'));

    // Verify docs field is now present and correct
    expect(json.docs).to.exist;
    expect(json.docs).to.deep.equal(docsJson);
    expect(json.docs.LitCID).to.equal(cid);
    expect(json.docs.Description).to.include("LitProtocol");

    // Verify other fields are still correct
    expect(json.name).to.be.equal("Entity 2 - Series 3");
    expect(json.image).to.be.equal("goldBadgeURLWY");
    expect(json.external_url).to.include("ethereum:4");
  });

  it("Check OtoCoURI with different network prefixes", async function () {

    // Deploy URI with different network prefix
    const EntityURI = await ethers.getContractFactory("OtoCoURI");
    
    // Test with polygon prefix
    const entityURIPolygon = await EntityURI.deploy(otocoMaster.address, "polygon");
    await entityURIPolygon.deployed();
    await otocoMaster.changeURISources(entityURIPolygon.address);

    let tokenURI = await otocoMaster.tokenURI(4);
    let buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));
    expect(json.external_url).to.include("polygon:4");
    expect(json.external_url).to.not.include("ethereum:4");

    // Test with base prefix
    const entityURIBase = await EntityURI.deploy(otocoMaster.address, "base");
    await entityURIBase.deployed();
    await otocoMaster.changeURISources(entityURIBase.address);

    tokenURI = await otocoMaster.tokenURI(7);
    buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.external_url).to.include("base:7");

    // Test with empty prefix
    const entityURIEmpty = await EntityURI.deploy(otocoMaster.address, "");
    await entityURIEmpty.deployed();
    await otocoMaster.changeURISources(entityURIEmpty.address);

    tokenURI = await otocoMaster.tokenURI(0);
    buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.external_url).to.include("https://otoco.io/dashpanel/entity/:0");
  });

  it("Check OtoCoURI validates all JSON fields and NFT standard compliance", async function () {

    const tokenURI = await otocoMaster.tokenURI(4);
    const buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    const json = JSON.parse(buff.toString('utf-8'));

    // Verify all required NFT metadata fields exist
    expect(json).to.have.property('name');
    expect(json).to.have.property('description');
    expect(json).to.have.property('image');
    expect(json).to.have.property('external_url');
    expect(json).to.have.property('attributes');
    expect(json).to.have.property('docs'); // Should have docs from previous test

    // Verify field types
    expect(json.name).to.be.a('string');
    expect(json.description).to.be.a('string');
    expect(json.image).to.be.a('string');
    expect(json.external_url).to.be.a('string');
    expect(json.attributes).to.be.an('array');
    expect(json.docs).to.be.an('object');

    // Verify description contains required text
    expect(json.description).to.include("OtoCo NFTs");
    expect(json.description).to.include("holder of this NFT");
    expect(json.description).to.include(json.name);
    expect(json.description).to.include("https://otoco.io");

    // Verify attributes have correct structure
    json.attributes.forEach(attr => {
      expect(attr).to.have.property('trait_type');
      expect(attr).to.have.property('value');
      expect(attr.trait_type).to.be.a('string');
      expect(attr.value).to.be.a('string');
    });

    // Verify Creation attribute has display_type
    expect(json.attributes[0]).to.have.property('display_type');
    expect(json.attributes[0].display_type).to.equal('date');
  });

  it("Check OtoCoURI tokenExternalURI function directly with different lastMigrated values", async function () {

    // Get the current URI contract
    const entityURIAddress = await otocoMaster.entitiesURI();
    const EntityURI = await ethers.getContractFactory("OtoCoURI");
    const entityURI = EntityURI.attach(entityURIAddress);

    // Test tokenExternalURI directly with different lastMigrated scenarios
    // Note: lastMigrated is internal in OtoCoMasterV2, so we test the URI function directly
    
    // Test with lastMigrated = 7 (current value from migration)
    // Entities 0-6 should have gold badges, 7+ should have default badges
    const uri1 = await entityURI.tokenExternalURI(4, 7);
    expect(uri1).to.include('data:application/json;base64,');
    
    let buff = Buffer.from(uri1.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.equal("goldBadgeURLWY"); // tokenId 4 is Wyoming, < lastMigrated(7), should be gold
    expect(json.name).to.equal("Entity 2 - Series 3");
    
    // Test with tokenId >= lastMigrated (should use default badge)
    const uri2 = await entityURI.tokenExternalURI(7, 7);
    buff = Buffer.from(uri2.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.equal("defaultBadgeURLWY"); // tokenId 7 >= lastMigrated(7), should be default
    expect(json.name).to.equal("New Entity - Series 5");
    
    // Test with lastMigrated = 0 (all entities should have default badge)
    const uri3 = await entityURI.tokenExternalURI(4, 0);
    buff = Buffer.from(uri3.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.equal("defaultBadgeURLWY"); // lastMigrated = 0, all should be default
    
    // Test with lastMigrated > tokenId (should have gold badge)
    const uri4 = await entityURI.tokenExternalURI(4, 100);
    buff = Buffer.from(uri4.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.equal("goldBadgeURLWY"); // lastMigrated(100) > tokenId(4), should be gold
    
    // Test edge case: tokenId = lastMigrated exactly
    const uri5 = await entityURI.tokenExternalURI(5, 5);
    buff = Buffer.from(uri5.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.equal("defaultBadgeURLWY"); // tokenId = lastMigrated, should be default
    
    // Test another entity with different jurisdiction
    const uri6 = await entityURI.tokenExternalURI(1, 7);
    buff = Buffer.from(uri6.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    expect(json.image).to.equal("goldBadgeURLDE"); // Delaware gold badge
    expect(json.attributes[1].value).to.equal("DELAWARE");
  });

  it("Add addresses as allowed marketplaces and add entity as marketplace", async function () {
    const addrs = [owner.address, wallet2.address];
    const states = [true, true];
    const name = "Standalone Entity";
    const transaction = await otocoMaster.setMarketplaceAddresses(addrs, states);
    // only addresses allowed as marketplaces can call addEntity
    const transaction2 = await otocoMaster.connect(wallet2).addEntity(0, 1, "Standalone Entity");

    expect(transaction).to.be.ok;
    expect(transaction2).to.be.ok;
    await expect(otocoMaster
      .connect(wallet4)
      .setMarketplaceAddresses([zeroAddress], [true])
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(otocoMaster
      .connect(wallet4)
      .addEntity(0, 0, name)
    ).to.be.revertedWithCustomError(otocoMaster, "NotAllowed");

    // check for storage update in nft methods and in otocoMaster storage
    expect(await otocoMaster.ownerOf(11)).to.eq(wallet2.address);
    expect((await otocoMaster.callStatic.series(11)).name).to.eq(name);
    expect((await otocoMaster.callStatic.series(11)).jurisdiction).to.eq(ethers.constants.Zero);
    expect((await otocoMaster.callStatic.series(11)).entityType).to.eq(ethers.constants.One);
    expect(await otocoMaster.callStatic.seriesCount()).to.eq(ethers.BigNumber.from(12));
    expect(await otocoMaster.callStatic.seriesPerJurisdiction(0)).to.eq(ethers.BigNumber.from(3));

  });

  it("Extend entity expiration date", async function () {

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const unc = Unincorporated.attach(await otocoMaster.jurisdictionAddress(0));
    const renewalPrice = await unc.callStatic.getJurisdictionRenewalPrice();
    const conversion = (await priceFeed.latestRoundData()).answer;
    const amountToPayForRenew = EthDividend.div(conversion).mul(renewalPrice);
    const yearInSecs = ethers.BigNumber.from(31536000);

    const oldExpiration1 = (await otocoMaster.callStatic.series(11)).expiration;
    const transaction = await otocoMaster.connect(wallet2).renewEntity(11, 1, { value: amountToPayForRenew });
    const transaction2 = await otocoMaster.renewEntity(5, 2, { value: amountToPayForRenew.mul(ethers.constants.Two) });
    const newExpiration1 = (await otocoMaster.callStatic.series(11)).expiration;
    const newExpiration2 = (await otocoMaster.callStatic.series(5)).expiration;
    const bn = await otocoMaster.provider.getBlockNumber();
    const timestamp = ethers.BigNumber.from((await otocoMaster.provider.getBlock(bn)).timestamp);

    expect(transaction).to.be.ok;
    expect(transaction2).to.be.ok;
    expect(newExpiration1).to.eq(oldExpiration1.add(yearInSecs));
    expect(newExpiration2).to.eq(timestamp.add(yearInSecs.mul(ethers.constants.Two)));

    await expect(otocoMaster.connect(wallet2)
      .renewEntity(11, 1)).to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

  });

  it("Add new jurisdiction and update existing jurisdiction's address", async function () {
    const oldStorage = [
      await otocoMaster.callStatic.jurisdictionCount(), 
      await otocoMaster.callStatic.jurisdictionAddress(4),
    ];
    const addr = (ethers.Wallet.createRandom()).address;
    const transaction = await otocoMaster.addJurisdiction(addr);
    const newStorage = [
      await otocoMaster.callStatic.jurisdictionCount(), 
      await otocoMaster.callStatic.jurisdictionAddress(4),
    ];

    const transaction2 = await otocoMaster.updateJurisdiction(2, owner.address);
    const storageUpdate = await otocoMaster.callStatic.jurisdictionAddress(2);

    const transaction3 = await otocoMaster.updateJurisdiction(2, zeroAddress);
    const storageUpdate2 = await otocoMaster.callStatic.jurisdictionAddress(2);


    expect(transaction).to.be.ok;
    expect(oldStorage[0]).to.eq(4);
    expect(oldStorage[1]).to.eq(zeroAddress);
    expect(newStorage[0]).to.eq(5);
    expect(newStorage[1]).to.eq(addr);
    expect(transaction2).to.be.ok;
    expect(transaction3).to.be.ok;
    expect(storageUpdate).to.eq(owner.address);
    expect(storageUpdate2).to.eq(zeroAddress);

    await expect(otocoMaster
      .connect(wallet3)
      .addJurisdiction(zeroAddress))
    .to.be.revertedWith("Ownable: caller is not the owner");
    await expect(otocoMaster
      .connect(wallet4)
      .updateJurisdiction(0, zeroAddress))
    .to.be.revertedWith("Ownable: caller is not the owner");
      
  });

});