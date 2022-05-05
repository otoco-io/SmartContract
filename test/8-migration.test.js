const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
const { zeroAddress } = require("ethereumjs-util");
const { ConsensusAlgorithm } = require("@ethereumjs/common");
const { json } = require("hardhat/internal/core/params/argumentTypes");
chai.use(solidity);
const fs = require('fs').promises;

const readline = require('readline');

describe("Test Entities migration", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions = [];
  let controllers = [];
  let creations = [];
  let names = [];

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

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
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);

    // To be re-used after
    jurisdictions = [];
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
      
    const jurisdictionDict = {
        "DAO": 0,
        "DELAWARE": 1,
        "WYOMING": 2
    }
    let jsonDoc;
    try {
        const data = await fs.readFile("./test/companies.json", "binary");
        jsonDoc = JSON.parse(data);
    } catch (err) {
        console.log("No companies to test migration.", err);
    }

    if (jsonDoc?.data?.companies){
        jsonDoc.data.companies.map( (s) => {
            jurisdictions.push(jurisdictionDict[s.jurisdiction]);
            names.push(s.name);
            creations.push(s.creation)
            controllers.push(s.owner);
        })
    }

    const slices = 100;
    for(let i=0; i<names.length; i+=slices){
        const transaction = await otocoMaster.createBatchSeries(
            jurisdictions.slice(i,i+slices),
            controllers.slice(i,i+slices),
            creations.slice(i,i+slices),
            names.slice(i,i+slices),
            {gasPrice: ethers.BigNumber.from("80000000000")}
        );
        console.log((await transaction.wait()).cumulativeGasUsed.toString());
        console.log(ethers.utils.formatEther((await transaction.wait()).cumulativeGasUsed.mul("80000000000")));
    }

    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(jurisdictions.length);

  });
  
});