const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OtoCo Jurisdiction V2 Additional Test", function () {
  let jurisdictions;

  it("Create Additional V2 Jurisdictions and test values", async function () {

    const DelawareLLC = await ethers.getContractFactory("JurisdictionDelawareLLCV2");
    const WyomingLLC = await ethers.getContractFactory("JurisdictionWyomingLLCV2");
    const MarshallIslands = await ethers.getContractFactory("JurisdictionMarshallIslandsV2");
    const UnaDuna = await ethers.getContractFactory("JurisdictionUnaDunaV2");

    const delawareLLC = await DelawareLLC.deploy(
      5,      // renewPrice
      5,      // deployPrice
      10,     // closePrice
      'DELAWARE LLC',
      'defaultBadgeURLDELLC',
      'goldBadgeURLDELLC'
    );
    
    const wyomingLLC = await WyomingLLC.deploy(
      50,     // renewPrice
      40,     // deployPrice
      150000, // closePrice
      'WYOMING LLC',
      'defaultBadgeURLWYLLC',
      'goldBadgeURLWYLLC'
    );
    
    const marshallIslands = await MarshallIslands.deploy(
      10,     // renewPrice
      10,     // deployPrice
      10,     // closePrice
      'MARSHALL ISLANDS',
      'defaultBadgeURLMI',
      'goldBadgeURLMI'
    );
    
    const unaDuna = await UnaDuna.deploy(
      15,     // renewPrice
      15,     // deployPrice
      20,     // closePrice
      'UNA DUNA',
      'defaultBadgeURLUD',
      'goldBadgeURLUD'
    );

    await delawareLLC.deployed();
    await wyomingLLC.deployed();
    await marshallIslands.deployed();
    await unaDuna.deployed();

    // Verify values at deployment for Delaware LLC
    expect(await delawareLLC.getJurisdictionName()).to.equal('DELAWARE LLC');
    expect(await delawareLLC.getJurisdictionBadge()).to.equal('defaultBadgeURLDELLC');
    expect(await delawareLLC.getJurisdictionGoldBadge()).to.equal('goldBadgeURLDELLC');
    expect(await delawareLLC.getJurisdictionRenewalPrice()).to.equal(5);
    expect(await delawareLLC.getJurisdictionDeployPrice()).to.equal(5);
    expect(await delawareLLC.getJurisdictionClosePrice()).to.equal(10);

    // Verify values at deployment for Wyoming LLC
    expect(await wyomingLLC.getJurisdictionName()).to.equal('WYOMING LLC');
    expect(await wyomingLLC.getJurisdictionBadge()).to.equal('defaultBadgeURLWYLLC');
    expect(await wyomingLLC.getJurisdictionGoldBadge()).to.equal('goldBadgeURLWYLLC');
    expect(await wyomingLLC.getJurisdictionRenewalPrice()).to.equal(50);
    expect(await wyomingLLC.getJurisdictionDeployPrice()).to.equal(40);
    expect(await wyomingLLC.getJurisdictionClosePrice()).to.equal(150000);

    // Verify values at deployment for Marshall Islands
    expect(await marshallIslands.getJurisdictionName()).to.equal('MARSHALL ISLANDS');
    expect(await marshallIslands.getJurisdictionBadge()).to.equal('defaultBadgeURLMI');
    expect(await marshallIslands.getJurisdictionGoldBadge()).to.equal('goldBadgeURLMI');
    expect(await marshallIslands.getJurisdictionRenewalPrice()).to.equal(10);
    expect(await marshallIslands.getJurisdictionDeployPrice()).to.equal(10);
    expect(await marshallIslands.getJurisdictionClosePrice()).to.equal(10);

    // Verify values at deployment for Una Duna
    expect(await unaDuna.getJurisdictionName()).to.equal('UNA DUNA');
    expect(await unaDuna.getJurisdictionBadge()).to.equal('defaultBadgeURLUD');
    expect(await unaDuna.getJurisdictionGoldBadge()).to.equal('goldBadgeURLUD');
    expect(await unaDuna.getJurisdictionRenewalPrice()).to.equal(15);
    expect(await unaDuna.getJurisdictionDeployPrice()).to.equal(15);
    expect(await unaDuna.getJurisdictionClosePrice()).to.equal(20);

    jurisdictions = [delawareLLC.address, wyomingLLC.address, marshallIslands.address, unaDuna.address];
  });

  it("Verify name formatting for all jurisdictions", async function () {

    const DelawareLLC = await ethers.getContractFactory("JurisdictionDelawareLLCV2");
    const WyomingLLC = await ethers.getContractFactory("JurisdictionWyomingLLCV2");
    const MarshallIslands = await ethers.getContractFactory("JurisdictionMarshallIslandsV2");
    const UnaDuna = await ethers.getContractFactory("JurisdictionUnaDunaV2");

    const delawareLLC = await DelawareLLC.deploy(5, 5, 10, 'DELAWARE LLC', 'defaultBadgeURLDELLC', 'goldBadgeURLDELLC');
    const wyomingLLC = await WyomingLLC.deploy(50, 40, 150000, 'WYOMING LLC', 'defaultBadgeURLWYLLC', 'goldBadgeURLWYLLC');
    const marshallIslands = await MarshallIslands.deploy(10, 10, 10, 'MARSHALL ISLANDS', 'defaultBadgeURLMI', 'goldBadgeURLMI');
    const unaDuna = await UnaDuna.deploy(15, 15, 20, 'UNA DUNA', 'defaultBadgeURLUD', 'goldBadgeURLUD');

    // Verify name formatting for Delaware LLC (appends ' LLC')
    expect(await delawareLLC.getSeriesNameFormatted(0, 'Test Company')).to.equal('Test Company LLC');
    expect(await delawareLLC.getSeriesNameFormatted(1, 'My Business')).to.equal('My Business LLC');
    expect(await delawareLLC.getSeriesNameFormatted(99, 'Acme Corp')).to.equal('Acme Corp LLC');

    // Verify name formatting for Wyoming LLC (appends ' LLC')
    expect(await wyomingLLC.getSeriesNameFormatted(0, 'Test Company')).to.equal('Test Company LLC');
    expect(await wyomingLLC.getSeriesNameFormatted(1, 'My Business')).to.equal('My Business LLC');
    expect(await wyomingLLC.getSeriesNameFormatted(99, 'Acme Corp')).to.equal('Acme Corp LLC');

    // Verify name formatting for Marshall Islands (appends ' LLC')
    expect(await marshallIslands.getSeriesNameFormatted(0, 'Test Company')).to.equal('Test Company LLC');
    expect(await marshallIslands.getSeriesNameFormatted(1, 'My Business')).to.equal('My Business LLC');
    expect(await marshallIslands.getSeriesNameFormatted(99, 'Acme Corp')).to.equal('Acme Corp LLC');

    // Verify name formatting for Una Duna (appends ' Association')
    expect(await unaDuna.getSeriesNameFormatted(0, 'Test Company')).to.equal('Test Company Association');
    expect(await unaDuna.getSeriesNameFormatted(1, 'My Business')).to.equal('My Business Association');
    expect(await unaDuna.getSeriesNameFormatted(99, 'Acme Corp')).to.equal('Acme Corp Association');
  });

  it("Test price getters for all jurisdictions", async function () {

    const DelawareLLC = await ethers.getContractFactory("JurisdictionDelawareLLCV2");
    const WyomingLLC = await ethers.getContractFactory("JurisdictionWyomingLLCV2");
    const MarshallIslands = await ethers.getContractFactory("JurisdictionMarshallIslandsV2");
    const UnaDuna = await ethers.getContractFactory("JurisdictionUnaDunaV2");

    const delawareLLC = await DelawareLLC.deploy(5, 5, 10, 'DELAWARE LLC', 'defaultBadgeURLDELLC', 'goldBadgeURLDELLC');
    const wyomingLLC = await WyomingLLC.deploy(50, 40, 150000, 'WYOMING LLC', 'defaultBadgeURLWYLLC', 'goldBadgeURLWYLLC');
    const marshallIslands = await MarshallIslands.deploy(10, 10, 10, 'MARSHALL ISLANDS', 'defaultBadgeURLMI', 'goldBadgeURLMI');
    const unaDuna = await UnaDuna.deploy(15, 15, 20, 'UNA DUNA', 'defaultBadgeURLUD', 'goldBadgeURLUD');

    // Delaware LLC prices
    expect(await delawareLLC.getJurisdictionRenewalPrice()).to.equal(5);
    expect(await delawareLLC.getJurisdictionDeployPrice()).to.equal(5);
    expect(await delawareLLC.getJurisdictionClosePrice()).to.equal(10);

    // Wyoming LLC prices
    expect(await wyomingLLC.getJurisdictionRenewalPrice()).to.equal(50);
    expect(await wyomingLLC.getJurisdictionDeployPrice()).to.equal(40);
    expect(await wyomingLLC.getJurisdictionClosePrice()).to.equal(150000);

    // Marshall Islands prices
    expect(await marshallIslands.getJurisdictionRenewalPrice()).to.equal(10);
    expect(await marshallIslands.getJurisdictionDeployPrice()).to.equal(10);
    expect(await marshallIslands.getJurisdictionClosePrice()).to.equal(10);

    // Una Duna prices
    expect(await unaDuna.getJurisdictionRenewalPrice()).to.equal(15);
    expect(await unaDuna.getJurisdictionDeployPrice()).to.equal(15);
    expect(await unaDuna.getJurisdictionClosePrice()).to.equal(20);
  });

  it("Test badge URLs for all jurisdictions", async function () {

    const DelawareLLC = await ethers.getContractFactory("JurisdictionDelawareLLCV2");
    const WyomingLLC = await ethers.getContractFactory("JurisdictionWyomingLLCV2");
    const MarshallIslands = await ethers.getContractFactory("JurisdictionMarshallIslandsV2");
    const UnaDuna = await ethers.getContractFactory("JurisdictionUnaDunaV2");

    const delawareLLC = await DelawareLLC.deploy(5, 5, 10, 'DELAWARE LLC', 'https://badges.example.com/de-llc', 'https://badges.example.com/de-llc-gold');
    const wyomingLLC = await WyomingLLC.deploy(50, 40, 150000, 'WYOMING LLC', 'https://badges.example.com/wy-llc', 'https://badges.example.com/wy-llc-gold');
    const marshallIslands = await MarshallIslands.deploy(10, 10, 10, 'MARSHALL ISLANDS', 'https://badges.example.com/mi', 'https://badges.example.com/mi-gold');
    const unaDuna = await UnaDuna.deploy(15, 15, 20, 'UNA DUNA', 'https://badges.example.com/ud', 'https://badges.example.com/ud-gold');

    // Delaware LLC badges
    expect(await delawareLLC.getJurisdictionBadge()).to.equal('https://badges.example.com/de-llc');
    expect(await delawareLLC.getJurisdictionGoldBadge()).to.equal('https://badges.example.com/de-llc-gold');

    // Wyoming LLC badges
    expect(await wyomingLLC.getJurisdictionBadge()).to.equal('https://badges.example.com/wy-llc');
    expect(await wyomingLLC.getJurisdictionGoldBadge()).to.equal('https://badges.example.com/wy-llc-gold');

    // Marshall Islands badges
    expect(await marshallIslands.getJurisdictionBadge()).to.equal('https://badges.example.com/mi');
    expect(await marshallIslands.getJurisdictionGoldBadge()).to.equal('https://badges.example.com/mi-gold');

    // Una Duna badges
    expect(await unaDuna.getJurisdictionBadge()).to.equal('https://badges.example.com/ud');
    expect(await unaDuna.getJurisdictionGoldBadge()).to.equal('https://badges.example.com/ud-gold');
  });
});
