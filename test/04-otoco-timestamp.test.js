const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OtoCo Timestamp Plugins Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;

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

  it("Initialize Master, add jurisdictions and create Series", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
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

  it("Deploy Timestamp plugin", async function () {
    const [owner, wallet2] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("100000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const TimestampPluginFactory = await ethers.getContractFactory("Timestamp");
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
    .to.be.revertedWith('OtoCoPlugin: Attach elements are not possible on this plugin.');
    
    await expect(timestampPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Remove elements are not possible on this plugin.');

    // There's no Attach function at Launchpool plugin
    await expect(timestampPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(timestampPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    // There's no Attach function at Launchpool plugin
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

});