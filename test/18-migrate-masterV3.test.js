const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const utils = require('./utils');

const EthDividend = ethers.BigNumber.from(ethers.utils.parseUnits('1', 18)).mul(ethers.utils.parseUnits('1', 9)).div(10);

describe("OtoCo Master V2 to V3 Upgrade Test", function () {

  let owner, wallet2, wallet3, wallet4, marketplace;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let priceFeed;

  const zeroAddress = ethers.constants.AddressZero;

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4, marketplace] = await ethers.getSigners();

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

  it("Initialize Master V1 and add jurisdictions", async function () {
    OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
  });

  it("Create some entities in V1", async function () {
    const jurisdictionsArray = [0, 1, 2];
    const controllers = [wallet2.address, wallet3.address, wallet4.address];
    const creations = [10000, 20000, 30000];
    const names = ['Entity 1', 'Entity 2 LLC', 'Entity 3 - Series 1'];

    await otocoMaster.createBatchSeries(jurisdictionsArray, controllers, creations, names);

    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(3);
  });

  it("Update Master contract to V2", async function () {
    const OtoCoMasterV2 = await ethers.getContractFactory("OtoCoMasterV2");
    otocoMaster = await upgrades.upgradeProxy(otocoMaster.address, OtoCoMasterV2);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
  });

  it("Setup price feed and create entities in V2", async function () {
    // Setup price feed
    const PriceFeed = await ethers.getContractFactory("MockAggregatorV3");
    priceFeed = await PriceFeed.deploy();
    await otocoMaster.changePriceFeed(priceFeed.address);
    await otocoMaster.changeBaseFees("5000000000000000");

    // Create an entity in V2
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    const amountToPayForSpinUp = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await wy.getJurisdictionDeployPrice());
    
    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");
    
    await otocoMaster.createSeries(2, owner.address, "V2 Entity", {gasPrice, gasLimit, value: amountToPayForSpinUp});
    
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(4);
    // Wyoming series count is 2 (Entity 3 - Series 1 from V1, now V2 Entity - Series 2)
    expect((await otocoMaster.series(3)).name).to.be.equal("V2 Entity - Series 2");
  });

  it("Setup marketplace address in V2", async function () {
    await otocoMaster.setMarketplaceAddresses([marketplace.address], [true]);
    
    // Create entity as marketplace using addEntity (V2 function)
    await otocoMaster.connect(marketplace).addEntity(0, 1, "Marketplace Entity");
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(5);
  });

  it("Update Master contract from V2 to V3", async function () {
    const OtoCoMasterV3 = await ethers.getContractFactory("OtoCoMasterV3");
    otocoMaster = await upgrades.upgradeProxy(otocoMaster.address, OtoCoMasterV3);
    await otocoMaster.deployed();

    // Verify contract identity is preserved
    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
    
    // Verify all storage was preserved
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(5);
    expect((await otocoMaster.series(0)).name).to.equal("Entity 1");
    expect((await otocoMaster.series(3)).name).to.equal("V2 Entity - Series 2");
    expect((await otocoMaster.series(4)).name).to.equal("Marketplace Entity");
    
    // Verify jurisdictions are preserved
    expect(await otocoMaster.jurisdictionCount()).to.equal(4);
    expect(await otocoMaster.jurisdictionAddress(0)).to.equal(jurisdictions[0]);
    expect(await otocoMaster.jurisdictionAddress(2)).to.equal(jurisdictions[2]);
  });

  it("Test V3 new feature: Owner can create series without payment", async function () {
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    
    // Owner should be able to create without payment
    const tx = await otocoMaster.createSeries(2, owner.address, "Owner No Fee Entity", {value: 0});
    await expect(tx).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 5);
    
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(6);
    expect((await otocoMaster.series(5)).name).to.equal("Owner No Fee Entity - Series 3");
  });

  it("Test V3 new feature: Marketplace can create series without payment", async function () {
    // Marketplace should be able to create without payment
    const tx = await otocoMaster.connect(marketplace).createSeries(1, marketplace.address, "Marketplace No Fee", {value: 0});
    await expect(tx).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, marketplace.address, 6);
    
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(7);
    expect((await otocoMaster.series(6)).name).to.equal("Marketplace No Fee LLC");
  });

  it("Test V3: Regular users still need to pay", async function () {
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    const amountToPayForSpinUp = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await wy.getJurisdictionDeployPrice());
    const notEnoughToPay = amountToPayForSpinUp.mul(100).div(101);
    
    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");

    // Regular user with insufficient payment should fail
    await expect(otocoMaster.connect(wallet2).createSeries(2, wallet2.address, "Regular User Entity", {
      gasPrice, 
      gasLimit, 
      value: notEnoughToPay
    })).to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

    // Regular user with correct payment should succeed
    const tx = await otocoMaster.connect(wallet2).createSeries(2, wallet2.address, "Regular User Entity", {
      gasPrice, 
      gasLimit, 
      value: amountToPayForSpinUp
    });
    await expect(tx).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, wallet2.address, 7);
    
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(8);
  });

  it("Test V3 new feature: Owner can use createEntityWithInitializer without payment", async function () {
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    
    // Owner should be able to create with initializer without payment
    const tx = await otocoMaster.createEntityWithInitializer(
      2,
      [zeroAddress], // no initializer
      ["0x"],
      0,
      "Owner Initializer Entity",
      {value: 0}
    );
    
    await expect(tx).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 8);
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(9);
  });

  it("Test V3 new feature: Marketplace can use createEntityWithInitializer without payment", async function () {
    // Marketplace should be able to create with initializer without payment
    const tx = await otocoMaster.connect(marketplace).createEntityWithInitializer(
      1,
      [zeroAddress], // no initializer
      ["0x"],
      0,
      "Marketplace Initializer",
      {value: 0}
    );
    
    await expect(tx).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, marketplace.address, 9);
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(10);
  });

  it("Test V3: Regular users still need to pay for createEntityWithInitializer", async function () {
    // Use the same utility function as test 11 to calculate correct payment
    const [amountToPayForSpinUp, gasPrice, gasLimit] = await utils.getAmountToPay(
      2,
      otocoMaster,
      "2000000000",
      "200000",
      priceFeed,
    );

    const notEnoughToPay = amountToPayForSpinUp.div(2); // 50% of required amount (clearly not enough)

    // Regular user with insufficient payment should fail
    await expect(otocoMaster.connect(wallet3).createEntityWithInitializer(
      2,
      [zeroAddress],
      ["0x"],
      0,
      "Regular Initializer",
      {gasPrice, gasLimit, value: notEnoughToPay}
    )).to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

    // Regular user with sufficient payment should succeed
    const tx = await otocoMaster.connect(wallet3).createEntityWithInitializer(
      2,
      [zeroAddress],
      ["0x"],
      0,
      "Regular Initializer",
      {gasPrice, gasLimit, value: amountToPayForSpinUp}
    );
    
    await expect(tx).to.emit(otocoMaster, 'Transfer');
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(11);
  });

  it("Test V3: All previous entities are still accessible", async function () {
    // Verify all entities from V1 and V2 are still accessible
    expect((await otocoMaster.ownerOf(0))).to.equal(wallet2.address);
    expect((await otocoMaster.ownerOf(1))).to.equal(wallet3.address);
    expect((await otocoMaster.ownerOf(2))).to.equal(wallet4.address);
    expect((await otocoMaster.ownerOf(3))).to.equal(owner.address);
    expect((await otocoMaster.ownerOf(4))).to.equal(marketplace.address);
    
    // Verify series data is intact
    expect((await otocoMaster.series(0)).jurisdiction).to.equal(0);
    expect((await otocoMaster.series(1)).jurisdiction).to.equal(1);
    expect((await otocoMaster.series(2)).jurisdiction).to.equal(2);
    expect((await otocoMaster.series(3)).jurisdiction).to.equal(2);
    expect((await otocoMaster.series(4)).jurisdiction).to.equal(0);
  });

  it("Test V3: Marketplace addresses are preserved for fee bypass", async function () {
    const currentCount = (await otocoMaster.seriesCount()).toNumber();
    
    // Verify marketplace can still create entities without fees in V3
    const tx = await otocoMaster.connect(marketplace).createSeries(0, marketplace.address, "Marketplace V3 Test", {value: 0});
    await expect(tx).to.emit(otocoMaster, 'Transfer');
    
    // Verify the marketplace created entity successfully (count should increase)
    expect((await otocoMaster.seriesCount()).toNumber()).to.equal(currentCount + 1);
  });

  it("Test V3: Admin functions still work", async function () {
    // Test withdrawFees
    const balanceBefore = await ethers.provider.getBalance(otocoMaster.address);
    if (balanceBefore.gt(0)) {
      await otocoMaster.withdrawFees();
      expect(await ethers.provider.getBalance(otocoMaster.address)).to.equal(0);
    }
    
    // Test updating jurisdiction
    const newJurisdiction = (ethers.Wallet.createRandom()).address;
    await otocoMaster.addJurisdiction(newJurisdiction);
    expect(await otocoMaster.jurisdictionCount()).to.equal(5);
    expect(await otocoMaster.jurisdictionAddress(4)).to.equal(newJurisdiction);
    
    // Test changing price feed
    const newPriceFeed = await (await ethers.getContractFactory("MockAggregatorV3")).deploy();
    await expect(otocoMaster.changePriceFeed(newPriceFeed.address))
      .to.emit(otocoMaster, "UpdatedPriceFeed")
      .withArgs(newPriceFeed.address);
  });

  it("Test V3: Only owner and marketplace can bypass fees, not other privileged functions", async function () {
    // Owner and marketplace can bypass fees, but other functions should still be protected
    
    // Only owner can add/update jurisdictions
    await expect(otocoMaster.connect(marketplace).addJurisdiction(zeroAddress))
      .to.be.revertedWith("Ownable: caller is not the owner");
    
    // Only owner can change price feed
    await expect(otocoMaster.connect(marketplace).changePriceFeed(zeroAddress))
      .to.be.revertedWith("Ownable: caller is not the owner");
    
    // Only owner can withdraw fees
    await expect(otocoMaster.connect(marketplace).withdrawFees())
      .to.be.revertedWith("Ownable: caller is not the owner");
    
    // Only owner can set marketplace addresses
    await expect(otocoMaster.connect(marketplace).setMarketplaceAddresses([wallet4.address], [true]))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Test V3: Storage slot compatibility validation", async function () {
    // This test ensures storage layout is compatible between V2 and V3
    
    // Check all storage variables are accessible and have expected values
    expect(await otocoMaster.seriesCount()).to.be.gt(0);
    expect(await otocoMaster.jurisdictionCount()).to.equal(5); // 4 original + 1 added
    expect(await otocoMaster.externalUrl()).to.equal('https://otoco.io/dashpanel/entity/');
    expect(await otocoMaster.baseFee()).to.equal("5000000000000000");
    
    // Verify price feed is accessible
    const conversion = await otocoMaster.priceConverter(100);
    expect(conversion).to.be.gt(0);
    
    // Verify mappings work correctly
    expect(await otocoMaster.jurisdictionAddress(0)).to.equal(jurisdictions[0]);
    expect(await otocoMaster.seriesPerJurisdiction(0)).to.be.gt(0);
    expect(await otocoMaster.seriesPerJurisdiction(1)).to.be.gt(0);
    expect(await otocoMaster.seriesPerJurisdiction(2)).to.be.gt(0);
  });

});
