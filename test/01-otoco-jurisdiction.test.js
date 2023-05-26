const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OtoCo Jurisdiction Test", function () {
  let jurisdictions;

  it("Create Jurisdictions and test values", async function () {

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporated");
    const Delaware = await ethers.getContractFactory("JurisdictionDelaware");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyoming");

    const unincorporated = await Unincorporated.deploy('DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy('DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy('WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');

    // Verify values at deployment
    expect(await unincorporated.getJurisdictionName()).to.equal('DAO');
    expect(await unincorporated.getJurisdictionBadge()).to.equal('defaultBadgeURL');
    expect(await unincorporated.getJurisdictionGoldBadge()).to.equal('goldBadgeURL');
    expect(await delaware.getJurisdictionName()).to.equal('DELAWARE');
    expect(await delaware.getJurisdictionBadge()).to.equal('defaultBadgeURLDE');
    expect(await delaware.getJurisdictionGoldBadge()).to.equal('goldBadgeURLDE');
    expect(await wyoming.getJurisdictionName()).to.equal('WYOMING');
    expect(await wyoming.getJurisdictionBadge()).to.equal('defaultBadgeURLWY');
    expect(await wyoming.getJurisdictionGoldBadge()).to.equal('goldBadgeURLWY');

    // Verify name formatting
    expect(await unincorporated.getSeriesNameFormatted(2, 'test')).to.equal('test');
    expect(await delaware.getSeriesNameFormatted(2, 'test')).to.equal('test LLC');
    expect(await wyoming.getSeriesNameFormatted(0, 'test')).to.equal('test - Series 1');
    expect(await wyoming.getSeriesNameFormatted(1, 'test')).to.equal('test - Series 2');
    expect(await wyoming.getSeriesNameFormatted(2, 'test')).to.equal('test - Series 3');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address];
  });
});