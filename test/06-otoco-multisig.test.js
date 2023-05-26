const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const utils = require('./utils');


describe("OtoCo Multisig Plugin Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let gnosisSafe;
  let gnosisSafeProxyFactory;
  let multisigPlugin;

  const zeroAddress = ethers.constants.AddressZero;

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

  it("Deploy External artifacts and test them", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const GnosisSafeArtifact = await utils.getExternalArtifact("GnosisSafe");
    const GnosisSafeFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
    gnosisSafe = await GnosisSafeFactory.deploy();

    const GnosisSafeProxyFactoryArtifact = await utils.getExternalArtifact("GnosisSafeProxyFactory");
    const GnosisSafeProxyFactoryFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
    gnosisSafeProxyFactory = await GnosisSafeProxyFactoryFactory.deploy();

    gnosisSafeInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);
    const data = gnosisSafeInterface.encodeFunctionData('setup', [
        [owner.address, wallet2.address],
        1,
        zeroAddress,
        [],
        zeroAddress,
        zeroAddress,
        0,
        zeroAddress
    ]);

    // Testing proxy creation
    let transaction = await gnosisSafeProxyFactory.createProxy(gnosisSafe.address, data);
    // console.log(await transaction.wait());
    const proxyAddress = (await transaction.wait()).events[1].args[0];
    await expect(transaction).to.emit(gnosisSafeProxyFactory, 'ProxyCreation').withArgs(proxyAddress, gnosisSafe.address);

  });

  it("Deploy plugin, add and remove", async function (){
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const MultisigPluginFactory = await ethers.getContractFactory("Multisig");
    multisigPlugin = await MultisigPluginFactory.deploy(
        otocoMaster.address,
        gnosisSafe.address,
        gnosisSafeProxyFactory.address,
        [1],
        [gnosisSafe.address]
    );
    
    let transaction = await multisigPlugin.updateGnosisMasterCopy(gnosisSafe.address);

    await expect(multisigPlugin.connect(wallet2).updateGnosisMasterCopy(gnosisSafe.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    transaction = await multisigPlugin.updateGnosisProxyFactory(gnosisSafeProxyFactory.address);

    await expect(multisigPlugin.connect(wallet2).updateGnosisProxyFactory(gnosisSafeProxyFactory.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    let encoded = gnosisSafeInterface.encodeFunctionData('setup', [
        [owner.address, wallet2.address],
        1,
        zeroAddress,
        [],
        zeroAddress,
        zeroAddress,
        0,
        zeroAddress
    ]);

    const prevBalance = await ethers.provider.getBalance(otocoMaster.address);
    transaction = await multisigPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    const multisigAddress = (await transaction.wait()).events[2].args.multisig;
    await expect(transaction).to.emit(multisigPlugin, 'MultisigAdded').withArgs(0,multisigAddress);
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equals(prevBalance.add(amountToPay));
    
    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(1);
    expect(await multisigPlugin.multisigDeployed(0,0)).to.be.equals(multisigAddress);

    encoded = ethers.utils.defaultAbiCoder.encode(['address'],[multisigAddress]);
    transaction = await multisigPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay})
    await expect(transaction).to.emit(multisigPlugin, 'MultisigAdded').withArgs(0,multisigAddress);

    await expect(multisigPlugin.attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(2);
    expect(await multisigPlugin.multisigDeployed(0,1)).to.be.equals(multisigAddress);

    encoded = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'],[0,1]);
    transaction = await multisigPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(multisigPlugin, 'MultisigRemoved').withArgs(0, multisigAddress);

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet3).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    });

});