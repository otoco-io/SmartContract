const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
const { zeroAddress } = require("ethereumjs-util");
const { ConsensusAlgorithm } = require("@ethereumjs/common");
chai.use(solidity);

const EthDividend = ethers.BigNumber.from(ethers.utils.parseUnits('1', 18)).mul(ethers.utils.parseUnits('1', 9)).div(10);

describe("OtoCo Master Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let priceFeed;

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    
    const unincorporated = await Unincorporated.deploy(0, 2, 'DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy(5, 5, 'DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy(50, 40, 'WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address];
  });

  it("Initialize Master and add jurisdictions", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    OtoCoMasterV2 = await ethers.getContractFactory("OtoCoMasterV2");
    otocoMaster = await upgrades.deployProxy(OtoCoMasterV2, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
  });

  it("Check jurisdiction order and count", async function () {

    const unincorporated = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(0));
    const delaware = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(1));
    const wyoming = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(2));

    expect(await otocoMaster.jurisdictionCount()).to.equal(3);

    expect(await unincorporated.getJurisdictionName()).to.equal("DAO");
    expect(await delaware.getJurisdictionName()).to.equal("DELAWARE");
    expect(await wyoming.getJurisdictionName()).to.equal("WYOMING");

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
  })

  it("Creating series with correct fees and wrong fees", async function () {

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");
    // Check the amount of ETH has to be paid after pass the priceFeed
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    const amountToPayForSpinUp = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await wy.getJurisdictionDeployPrice());
    // Remove 1% from the correct amount needed
    const notEnoughToPayForSpinUp = amountToPayForSpinUp.mul(100).div(101);

    // Try to create without the proper amount of ETH Value, expect to fail
    await expect(otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:notEnoughToPayForSpinUp}))
    .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

    const previousBalance = await ethers.provider.getBalance(otocoMaster.address);

    // Expected to successfully create a new entity
    const transaction = await otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress(), owner.address, 7);
    expect((await otocoMaster.series(7)).jurisdiction).to.be.equal(2)
    expect((await otocoMaster.series(7)).name).to.be.equal("New Entity - Series 5")
    
    // Chech if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(previousBalance.add(amountToPayForSpinUp));

  });

  it("Closing series with correct fees and wrong fees", async function () {

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("60000");
    const otocoBaseFee = await otocoMaster.baseFee();

    // 34750 reduction from gas limit is what is spended before check happens
    const amountToPayForClose = ethers.BigNumber.from(gasLimit).sub(30000).mul(otocoBaseFee);
    // Remove 1% from the correct amount needed
    const notEnoughToPayForClose = amountToPayForClose.mul(100).div(110);

    await expect(otocoMaster.closeSeries(7, {gasPrice, gasLimit, value:notEnoughToPayForClose}))
    .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue")

    await expect(otocoMaster.connect(wallet2).closeSeries(7, {gasPrice, gasLimit, value:amountToPayForClose}))
    .to.be.revertedWithCustomError(otocoMaster, 'IncorrectOwner');

    // Close the company
    const transactionClose = await otocoMaster.closeSeries(7, {gasPrice, gasLimit, value:amountToPayForClose});
    await expect(transactionClose).to.emit(otocoMaster, 'Transfer').withArgs(owner.address, zeroAddress(), 7);

    await expect(otocoMaster.ownerOf(6)).to.be.reverted

  });

  it("Update URI Sources and check if TokenURI are correct", async function () {

    const EntityURI = await ethers.getContractFactory("OtoCoURI");
    const entityURI = await EntityURI.deploy(otocoMaster.address);
    await entityURI.deployed();
    expect(await otocoMaster.changeURISources(entityURI.address))
    .to.emit(otocoMaster, "ChangedURISource")
    .withArgs(entityURI.address)
    expect(await otocoMaster.entitiesURI()).to.be.equals(entityURI.address);

    const tokenURI = await otocoMaster.tokenURI(4);
    const tokenURI2 = await otocoMaster.tokenURI(7);

    // Decode base64 data to read JSON data
    let buff = Buffer.from(tokenURI.split(',')[1], 'base64');
    let json = JSON.parse(buff.toString('utf-8'));
    
    expect(json.name).to.be.equal("Entity 2 - Series 3");
    expect(json.image).to.be.equal("goldBadgeURLWY");

    // Decode base64 data to read JSON data
    buff = Buffer.from(tokenURI2.split(',')[1], 'base64');
    json = JSON.parse(buff.toString('utf-8'));
    
    expect(json.name).to.be.equal("New Entity - Series 5");
    expect(json.image).to.be.equal("defaultBadgeURLWY");
    expect(json.attributes[0].trait_type).to.be.equal("Creation");
    expect(parseInt(json.attributes[0].value)).to.be.above(Date.now()*0.0001-5000);
    expect(json.attributes[1].trait_type).to.be.equal("Jurisdiction");
    expect(json.attributes[1].value).to.be.equals("WYOMING");
    // console.log(json)
  });

});