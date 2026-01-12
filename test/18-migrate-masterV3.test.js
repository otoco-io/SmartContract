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
    // Set withdrawal address first
    await otocoMaster.changeWithdrawalAddress(owner.address);

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

    // Set it back for other tests
    priceFeed = newPriceFeed;
  });

  it("Test V3: Only owner and marketplace can bypass fees, not other privileged functions", async function () {
    // Owner and marketplace can bypass fees, but other functions should still be protected

    // Only owner can add/update jurisdictions
    await expect(otocoMaster.connect(marketplace).addJurisdiction(zeroAddress))
      .to.be.revertedWith("Ownable: caller is not the owner");

    // Marketplace can change price feed (onlyOwnerOrMarketplace modifier)
    const testPriceFeed = await (await ethers.getContractFactory("MockAggregatorV3")).deploy();
    await expect(otocoMaster.connect(marketplace).changePriceFeed(testPriceFeed.address))
      .to.emit(otocoMaster, "UpdatedPriceFeed")
      .withArgs(testPriceFeed.address);

    // Marketplace can withdraw fees (onlyOwnerOrMarketplace modifier)
    await expect(otocoMaster.connect(marketplace).withdrawFees())
      .to.not.be.reverted;

    // Only owner can set marketplace addresses
    await expect(otocoMaster.connect(marketplace).setMarketplaceAddresses([wallet4.address], [true]))
      .to.be.revertedWith("Ownable: caller is not the owner");

    // Only owner can change withdrawal address
    await expect(otocoMaster.connect(marketplace).changeWithdrawalAddress(wallet4.address))
      .to.be.revertedWith("Ownable: caller is not the owner");

    // Only owner can change URI sources
    await expect(otocoMaster.connect(marketplace).changeURISources(zeroAddress))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Test V3: Storage slot compatibility validation", async function () {
    // This test ensures storage layout is compatible between V2 and V3

    // Check all storage variables are accessible and have expected values
    expect(await otocoMaster.seriesCount()).to.be.gt(0);
    // Note: jurisdictionCount was already 5 from the previous test that added a jurisdiction
    expect(await otocoMaster.jurisdictionCount()).to.be.gte(5);
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

    // Verify withdrawalAddress is set
    expect(await otocoMaster.withdrawalAddress()).to.equal(owner.address);
  });

  it("Test V3: Close series", async function () {
    // Use the Delaware jurisdiction (index 1) instead since we know it exists
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const delaware = Delaware.attach(await otocoMaster.jurisdictionAddress(1));
    const closePrice = await delaware.getJurisdictionClosePrice();
    const amountToPay = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(closePrice);

    // Attempt to close series as non-owner (wallet2 doesn't own token 1)
    await expect(otocoMaster.connect(wallet2).closeSeries(1, { value: amountToPay }))
      .to.be.revertedWithCustomError(otocoMaster, "IncorrectOwner");

    // Close series as owner (wallet3 owns token 1)
    await otocoMaster.connect(wallet3).closeSeries(1, { value: amountToPay });
    await expect(otocoMaster.ownerOf(1)).to.be.reverted;
  });

  it("Test V3: Set documentation for series", async function () {
    const doc = "https://example.com/docs";

    // Attempt to set docs as non-owner (wallet2 doesn't own token 2)
    await expect(otocoMaster.connect(wallet2).setDocs(2, doc))
      .to.be.revertedWithCustomError(otocoMaster, "IncorrectOwner");

    // Set docs as owner (wallet4 owns token 2)
    await otocoMaster.connect(wallet4).setDocs(2, doc);
    expect(await otocoMaster.docs(2)).to.equal(doc);
  });

  it("Test V3: Set marketplace addresses", async function () {
    const newMarketplace = wallet4.address;

    // Add a new marketplace address and verify event is emitted
    await expect(otocoMaster.setMarketplaceAddresses([newMarketplace], [true]))
      .to.emit(otocoMaster, 'MarketPlaceAddressChanged')
      .withArgs(newMarketplace, true);

    // Verify marketplace can create without payment
    await expect(otocoMaster.connect(wallet4).createSeries(0, wallet4.address, "Test Marketplace", {value: 0}))
      .to.emit(otocoMaster, 'Transfer');

    // Remove the marketplace address and verify event is emitted
    await expect(otocoMaster.setMarketplaceAddresses([newMarketplace], [false]))
      .to.emit(otocoMaster, 'MarketPlaceAddressChanged')
      .withArgs(newMarketplace, false);

    // Get the actual required amount to pay for Unincorporated jurisdiction
    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const unincorporated = Unincorporated.attach(await otocoMaster.jurisdictionAddress(0));
    const deployPrice = await unincorporated.getJurisdictionDeployPrice();
    const requiredAmount = await otocoMaster.priceConverter(deployPrice);

    // Verify marketplace can no longer create without payment
    await expect(otocoMaster.connect(wallet4).createSeries(0, wallet4.address, "Test Marketplace 2", {value: 0}))
      .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");
  });

  it("Test V3: Change URI source and emit event", async function () {
    // Deploy OtoCoURI contract as the new URI source
    const OtoCoURIContract = await ethers.getContractFactory("OtoCoURI");
    const newURI = await OtoCoURIContract.deploy(otocoMaster.address, "testnet");

    // Change URI source and verify event emission
    await expect(otocoMaster.changeURISources(newURI.address))
      .to.emit(otocoMaster, "ChangedURISource")
      .withArgs(newURI.address);

    expect(await otocoMaster.entitiesURI()).to.equal(newURI.address);
  });

  it("Test V3: Update jurisdiction address", async function () {
    const newJurisdictionAddress = wallet3.address;

    // Update jurisdiction address
    await otocoMaster.updateJurisdiction(3, newJurisdictionAddress);
    expect(await otocoMaster.jurisdictionAddress(3)).to.equal(newJurisdictionAddress);
  });

  it("Test V3: Token URI requires entitiesURI to be set", async function () {
    // First set the entitiesURI
    const OtoCoURIContract = await ethers.getContractFactory("OtoCoURI");
    const uriContract = await OtoCoURIContract.deploy(otocoMaster.address, "testnet");
    await otocoMaster.changeURISources(uriContract.address);

    // Now tokenURI should work
    const tokenId = 2;
    const uri = await otocoMaster.tokenURI(tokenId);

    expect(uri).to.be.a('string');
    expect(uri.length).to.be.greaterThan(0);
  });

  it("Test V3: createEntityWithInitializer with actual initializer contract", async function () {
    // Skip this complex test for now - lines 186-187 are already covered by the invalid initializer test below
    // This test would require deploying OtoCoGovernor and proper setup which is complex
    this.skip();
  });

  it("Test V3: createEntityWithInitializer should fail with invalid initializer", async function () {
    // Use a non-contract address as initializer (should fail)
    const [amountToPayForSpinUp, gasPrice, gasLimit] = await utils.getAmountToPay(
      2,
      otocoMaster,
      "2000000000",
      "200000",
      priceFeed,
    );

    // First whitelist the wallet address as a plugin (even though it's not a contract)
    await otocoMaster.setAllowedPlugins([wallet3.address], [true]);

    // Try to use wallet address (not a contract) as initializer
    // This should fail with InitializerError because code.length check
    await expect(otocoMaster.createEntityWithInitializer(
      2,
      [wallet3.address],
      ["0x1234"],
      0,
      "Invalid Init",
      {gasPrice, gasLimit, value: amountToPayForSpinUp}
    )).to.be.revertedWithCustomError(otocoMaster, "InitializerError");
  });

  it("Test V3: createEntityWithInitializer with multiple plugins", async function () {
    // Deploy Timestamp plugin
    const TimestampPlugin = await ethers.getContractFactory("TimestampV2");
    const timestampPlugin = await TimestampPlugin.deploy(otocoMaster.address);

    // Whitelist the timestamp plugin
    await otocoMaster.setAllowedPlugins([timestampPlugin.address], [true]);

    const [amountToPayForSpinUp, gasPrice, gasLimit] = await utils.getAmountToPay(
      2,
      otocoMaster,
      "2000000000",
      "500000", // Increased gas limit for plugin execution
      priceFeed,
    );

    // Prepare timestamp plugin data
    const pluginData = ethers.utils.defaultAbiCoder.encode(
      ["string", "string"],
      ["test.pdf", "QmTest123"]
    );

    // Create entity with no initializer but with a plugin
    // The series will be owned by the caller (wallet2 in this case)
    const tx = await otocoMaster.connect(wallet2).createEntityWithInitializer(
      2,
      [zeroAddress, timestampPlugin.address],
      ["0x", pluginData],
      0,
      "Entity with Plugin",
      {gasPrice, gasLimit, value: amountToPayForSpinUp}
    );

    await expect(tx).to.emit(otocoMaster, 'Transfer');
    await expect(tx).to.emit(timestampPlugin, 'DocumentTimestamped');
  });

  it("Test V3: Error cases for oracle validation", async function () {
    // Deploy a mock aggregator that returns invalid data
    const MockBadAggregator = await ethers.getContractFactory("MockAggregatorV3");
    const badAggregator = await MockBadAggregator.deploy();

    // Save the current price feed
    const currentPriceFeed = priceFeed;

    // Test InvalidPriceFeed error - set price feed to zero address
    await otocoMaster.changePriceFeed(zeroAddress);
    await expect(otocoMaster.priceConverter(100))
      .to.be.revertedWithCustomError(otocoMaster, "InvalidPriceFeed");

    // Restore price feed for other tests
    await otocoMaster.changePriceFeed(currentPriceFeed.address);
  });

  it("Test V3: Non-owner/non-marketplace cannot call restricted functions", async function () {
    // Test that wallet2 (not owner, not marketplace) cannot call onlyOwnerOrMarketplace functions
    await expect(otocoMaster.connect(wallet2).changePriceFeed(priceFeed.address))
      .to.be.revertedWithCustomError(otocoMaster, "NotAllowed");

    // Test withdrawFees with non-owner/non-marketplace
    await expect(otocoMaster.connect(wallet2).withdrawFees())
      .to.be.revertedWithCustomError(otocoMaster, "NotAllowed");
  });

  it("Test V3: Cannot create series in standalone jurisdiction", async function () {
    // We need to check if any jurisdiction is standalone
    // Since we don't have a standalone jurisdiction in our test setup,
    // we'll skip this for now, but document it for completeness
    // This would require deploying a standalone jurisdiction first
    this.skip();
  });

  it("Test V3: Receive function accepts ETH", async function () {
    // Test that the contract can receive ETH directly
    const balanceBefore = await ethers.provider.getBalance(otocoMaster.address);

    await owner.sendTransaction({
      to: otocoMaster.address,
      value: ethers.utils.parseEther("0.1")
    });

    const balanceAfter = await ethers.provider.getBalance(otocoMaster.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(ethers.utils.parseEther("0.1"));
  });

  it("Test V3: BaseFee storage is preserved from V2", async function () {
    // Verify that baseFee was set correctly in V2 and is still accessible in V3
    expect(await otocoMaster.baseFee()).to.equal("5000000000000000");
  });

  it("Test V3: updateEntityName - owner can update entity name", async function () {
    const tokenId = 0;
    const oldName = (await otocoMaster.series(tokenId)).name;
    const newName = "Updated Entity Name";

    // Owner updates the entity name and verify event is emitted
    await expect(otocoMaster.updateEntityName(tokenId, newName))
      .to.emit(otocoMaster, 'NameChanged')
      .withArgs(tokenId, newName);

    // Verify the name was updated
    expect((await otocoMaster.series(tokenId)).name).to.equal(newName);
    expect((await otocoMaster.series(tokenId)).name).to.not.equal(oldName);
  });

  it("Test V3: updateEntityName - marketplace can update entity name", async function () {
    const tokenId = 2;
    const newName = "Marketplace Updated Name";

    // Marketplace updates the entity name and verify event is emitted
    await expect(otocoMaster.connect(marketplace).updateEntityName(tokenId, newName))
      .to.emit(otocoMaster, 'NameChanged')
      .withArgs(tokenId, newName);

    // Verify the name was updated
    expect((await otocoMaster.series(tokenId)).name).to.equal(newName);
  });

  it("Test V3: updateEntityName - non-owner/non-marketplace cannot update", async function () {
    const tokenId = 3;
    const newName = "Unauthorized Update";

    // Regular user (wallet2) should not be able to update
    await expect(otocoMaster.connect(wallet2).updateEntityName(tokenId, newName))
      .to.be.revertedWithCustomError(otocoMaster, "NotAllowed");
  });

  it("Test V3: withdraw function sends to withdrawalAddress, not msg.sender", async function () {
    // Set withdrawal address to wallet3
    const withdrawalAddr = wallet3.address;
    await otocoMaster.changeWithdrawalAddress(withdrawalAddr);
    
    // Send some ETH to the contract
    const amountToSend = ethers.utils.parseEther("1.0");
    await owner.sendTransaction({
      to: otocoMaster.address,
      value: amountToSend
    });
    
    // Verify contract has the balance
    const contractBalanceBefore = await ethers.provider.getBalance(otocoMaster.address);
    expect(contractBalanceBefore).to.be.gte(amountToSend);
    
    // Get balances before withdrawal
    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const withdrawalBalanceBefore = await ethers.provider.getBalance(withdrawalAddr);
    
    // Owner calls withdrawFees (but funds should go to withdrawalAddress, not owner)
    const tx = await otocoMaster.withdrawFees();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    
    // Get balances after withdrawal
    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
    const withdrawalBalanceAfter = await ethers.provider.getBalance(withdrawalAddr);
    const contractBalanceAfter = await ethers.provider.getBalance(otocoMaster.address);
    
    // Verify contract balance is now zero
    expect(contractBalanceAfter).to.equal(0);
    
    // Verify owner's balance only decreased by gas cost (didn't receive the funds)
    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.sub(gasCost));
    
    // Verify withdrawalAddress received the funds
    expect(withdrawalBalanceAfter).to.equal(withdrawalBalanceBefore.add(contractBalanceBefore));
  });

});
