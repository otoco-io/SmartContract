const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
const { zeroAddress } = require("ethereumjs-util");
chai.use(solidity);

describe("OtoCo Master Test", function () {

  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;

  it("Create Jurisdictions", async function () {
    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporated");
    const Delaware = await ethers.getContractFactory("JurisdictionDelaware");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyoming");
    
    const unincorporated = await Unincorporated.deploy('DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy('DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy('WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address];
  });

  it("Initialize Master and add jurisdictions", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [jurisdictions]);
    await otocoMaster.deployed();
    console.log("OtoCo Master deployed to:", otocoMaster.address);

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

  it("Test migration of previous entities", async function () {

    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

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

    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const jurisdictions = [2,2,2];
    const controllers = [wallet2.address, wallet3.address, wallet4.address];
    const creations = [10000, 20000, 30000];
    const names = ['Entity 1 - Series 2', 'Entity 2 - Series 3', 'Entity 3 - Series 4'];

    await otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names);

    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(6);

    const firstSeries = await otocoMaster.series(3);
    expect(firstSeries[0]).to.equal(2);
    expect(firstSeries[2].toNumber()).to.equal(10000);
    expect(firstSeries[3]).to.equal("Entity 1 - Series 2");

    const secondSeries = await otocoMaster.series(4);
    expect(secondSeries[0]).to.equal(2);
    expect(secondSeries[2].toNumber()).to.equal(20000);
    expect(secondSeries[3]).to.equal("Entity 2 - Series 3");

  });

  it("Check if rejections when migrate are triggered", async function () {

    const [owner, wallet2] = await ethers.getSigners();

    let jurisdictions = [];
    let controllers = [];
    let creations = [];
    let names = [];

    await expect(otocoMaster.connect(wallet2).createBatchSeries(jurisdictions, controllers, creations, names))
    .to.be.revertedWith('Ownable: caller is not the owner');

    jurisdictions = [2];

    await expect(otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names))
    .to.be.revertedWith('OtoCoMaster: Owner and Jurisdiction array should have same size.');

    jurisdictions = [2];
    controllers = [wallet2.address];

    await expect(otocoMaster.createBatchSeries(jurisdictions, controllers, creations, names))
    .to.be.revertedWith('OtoCoMaster: Owner and Name array should have same size.');

  });

  it("Creating and removing series", async function () {

    const [owner, wallet2] = await ethers.getSigners();

    
    await expect(otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice: "2000000000", value:"40000000000000000"}))
    .to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress(), owner.address, 6);

    

  });

});