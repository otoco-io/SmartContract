const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OtoCo TimestampV2 Plugin Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;

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

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPayForSpinUp = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    // Expected to successfully create a new entity
    await otocoMaster.connect(wallet2).createSeries(2, wallet2.address, "New Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
    // Expect to create another entity
    await otocoMaster.connect(wallet3).createSeries(1, wallet3.address, "Another Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
  });

  it("Deploy TimestampV2 plugin", async function () {
    const [owner, wallet2] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("100000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const TimestampPluginFactory = await ethers.getContractFactory("TimestampV2");
    const timestampPlugin = await TimestampPluginFactory.deploy(otocoMaster.address);
    
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string'],
        ['filename-test.pdf', '11223345566677778889aasbbvcccc']
    );
    const prevBalance = await ethers.provider.getBalance(otocoMaster.address);
    let transaction = await timestampPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(timestampPlugin, 'DocumentTimestamped');
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equals(prevBalance.add(amountToPay));

    const events = (await transaction.wait()).events;
    expect(events[0].args.filename).to.be.equals('filename-test.pdf');
    expect(events[0].args.cid).to.be.equals('11223345566677778889aasbbvcccc');

    await expect(timestampPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(timestampPlugin, 'AttachNotAllowed');
    
    await expect(timestampPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(timestampPlugin, 'RemoveNotAllowed');

    // Test unauthorized access
    await expect(timestampPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(timestampPlugin, 'Unauthorized');

    // Test insufficient ETH paid
    await expect(timestampPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    // Test migrateTimestamp - only owner can call
    await expect(timestampPlugin.connect(wallet2).migrateTimestamp(0, encoded))
    .to.be.revertedWith('Ownable: caller is not the owner');

    encoded = ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'uint256'],
      ['filename-test.pdf', '11223345566677778889aasbbvcccc', 20000]
    );

    transaction = await timestampPlugin.migrateTimestamp(0, encoded);
    await expect(transaction).to.emit(timestampPlugin, 'DocumentTimestamped');

    const events2 = (await transaction.wait()).events;
    expect(events2[0].args.filename).to.be.equals('filename-test.pdf');
    expect(events2[0].args.cid).to.be.equals('11223345566677778889aasbbvcccc');
    expect(events2[0].args.timestamp).to.be.equals(20000);

  });

  it("Test multiple timestamps for same entity", async function () {
    const [owner, wallet2] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("100000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const TimestampPluginFactory = await ethers.getContractFactory("TimestampV2");
    const timestampPlugin = await TimestampPluginFactory.deploy(otocoMaster.address);
    
    // Add first timestamp
    let encoded1 = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string'],
        ['document1.pdf', 'cid1']
    );
    let transaction1 = await timestampPlugin.connect(wallet2).addPlugin(0, encoded1, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction1).to.emit(timestampPlugin, 'DocumentTimestamped');

    // Add second timestamp for the same entity
    let encoded2 = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string'],
        ['document2.pdf', 'cid2']
    );
    let transaction2 = await timestampPlugin.connect(wallet2).addPlugin(0, encoded2, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction2).to.emit(timestampPlugin, 'DocumentTimestamped');

    const events1 = (await transaction1.wait()).events;
    const events2 = (await transaction2.wait()).events;
    
    expect(events1[0].args.filename).to.be.equals('document1.pdf');
    expect(events1[0].args.cid).to.be.equals('cid1');
    expect(events2[0].args.filename).to.be.equals('document2.pdf');
    expect(events2[0].args.cid).to.be.equals('cid2');
    
    // Verify timestamps are different (second should be >= first)
    expect(events2[0].args.timestamp).to.be.gte(events1[0].args.timestamp);
  });

  it("Test migrateTimestamp with various timestamps", async function () {
    const [owner, wallet2] = await ethers.getSigners();

    const TimestampPluginFactory = await ethers.getContractFactory("TimestampV2");
    const timestampPlugin = await TimestampPluginFactory.deploy(otocoMaster.address);
    
    // Migrate with past timestamp
    let encoded1 = ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'uint256'],
      ['old-doc.pdf', 'oldcid', 1000000]
    );
    let transaction1 = await timestampPlugin.migrateTimestamp(0, encoded1);
    await expect(transaction1).to.emit(timestampPlugin, 'DocumentTimestamped');
    const events1 = (await transaction1.wait()).events;
    expect(events1[0].args.timestamp).to.be.equals(1000000);

    // Migrate with another timestamp
    let encoded2 = ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'uint256'],
      ['another-doc.pdf', 'anothercid', 2000000]
    );
    let transaction2 = await timestampPlugin.migrateTimestamp(1, encoded2);
    await expect(transaction2).to.emit(timestampPlugin, 'DocumentTimestamped');
    const events2 = (await transaction2.wait()).events;
    expect(events2[0].args.timestamp).to.be.equals(2000000);
  });

});
