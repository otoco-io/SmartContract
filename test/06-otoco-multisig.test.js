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
    await otocoMaster.connect(wallet2).createSeries(2, wallet2.address, "New Entity", { gasPrice, gasLimit, value: amountToPayForSpinUp });
    // Expect to create another entity
    await otocoMaster.connect(wallet3).createSeries(1, wallet3.address, "Another Entity", { gasPrice, gasLimit, value: amountToPayForSpinUp });
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
    let transaction = await gnosisSafeProxyFactory.createProxyWithNonce(gnosisSafe.address, data, 123);
    // console.log(await transaction.wait());
    const proxyAddress = (await transaction.wait()).events[1].args[0];
    await expect(transaction).to.emit(gnosisSafeProxyFactory, 'ProxyCreation').withArgs(proxyAddress, gnosisSafe.address);
    await expect(gnosisSafeProxyFactory.createProxyWithNonce(gnosisSafe.address, data, 123)).to.be.revertedWith('Create2 call failed');
    await expect(gnosisSafeProxyFactory.createProxyWithNonce(gnosisSafe.address, data, 124)).to.emit(gnosisSafeProxyFactory, 'ProxyCreation');
    await expect(gnosisSafeProxyFactory.createProxyWithNonce(gnosisSafe.address, data, 124)).to.be.revertedWith('Create2 call failed');
    await expect(gnosisSafeProxyFactory.connect(wallet3).createProxyWithNonce(gnosisSafe.address, data, 123)).to.be.revertedWith('Create2 call failed');
    await expect(gnosisSafeProxyFactory.connect(wallet3).createProxyWithNonce(gnosisSafe.address, data, 124)).to.be.revertedWith('Create2 call failed');
    await expect(gnosisSafeProxyFactory.connect(wallet3).createProxyWithNonce(gnosisSafe.address, data, 125)).to.emit(gnosisSafeProxyFactory, 'ProxyCreation');
  });

  it("Deploy V1 plugin and test basic functionality", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    // Deploy V1 Multisig plugin
    const MultisigV1Factory = await ethers.getContractFactory("Multisig");
    const multisigV1Plugin = await MultisigV1Factory.deploy(
      otocoMaster.address,
      gnosisSafe.address,
      gnosisSafeProxyFactory.address,
      [1],
      [gnosisSafe.address]
    );

    expect(await multisigV1Plugin.multisigPerEntity(1)).to.be.equals(1);

    // Test owner-only functions
    await expect(multisigV1Plugin.updateGnosisMasterCopy(gnosisSafe.address))
      .to.not.be.reverted;
    await expect(multisigV1Plugin.connect(wallet2).updateGnosisMasterCopy(gnosisSafe.address))
      .to.be.revertedWith('Ownable: caller is not the owner');

    await expect(multisigV1Plugin.updateGnosisProxyFactory(gnosisSafeProxyFactory.address))
      .to.not.be.reverted;
    await expect(multisigV1Plugin.connect(wallet2).updateGnosisProxyFactory(gnosisSafeProxyFactory.address))
      .to.be.revertedWith('Ownable: caller is not the owner');

    // Test addPlugin with V1 (uses createProxy instead of createProxyWithNonce)
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

    const tx1 = await multisigV1Plugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
    const multisigAddress1 = (await tx1.wait()).events[2].args.multisig;
    await expect(tx1).to.emit(multisigV1Plugin, 'MultisigAdded').withArgs(0, multisigAddress1);

    expect(await multisigV1Plugin.multisigPerEntity(0)).to.be.equals(1);

    // Test attachPlugin
    const attachEncoded = ethers.utils.defaultAbiCoder.encode(['address'], [multisigAddress1]);
    const tx2 = await multisigV1Plugin.connect(wallet2).attachPlugin(0, attachEncoded, { gasPrice, gasLimit, value: amountToPay });
    await expect(tx2).to.emit(multisigV1Plugin, 'MultisigAdded').withArgs(0, multisigAddress1);

    expect(await multisigV1Plugin.multisigPerEntity(0)).to.be.equals(2);

    // Test removePlugin
    const removeEncoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [0]);
    const tx3 = await multisigV1Plugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay });
    await expect(tx3).to.emit(multisigV1Plugin, 'MultisigRemoved').withArgs(0, multisigAddress1);

    expect(await multisigV1Plugin.multisigPerEntity(0)).to.be.equals(1);

    // Test unauthorized access (V1 uses different error message)
    await expect(multisigV1Plugin.connect(wallet3).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');
    await expect(multisigV1Plugin.connect(wallet3).attachPlugin(0, attachEncoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');
    await expect(multisigV1Plugin.connect(wallet3).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // Test insufficient payment
    await expect(multisigV1Plugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: 0 }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');
    await expect(multisigV1Plugin.connect(wallet2).attachPlugin(0, attachEncoded, { gasPrice, gasLimit, value: 0 }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');
    await expect(multisigV1Plugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: 0 }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');
  });

  it("Deploy V2 plugin, add and remove", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const MultisigPluginFactory = await ethers.getContractFactory("MultisigV2");
    multisigPlugin = await MultisigPluginFactory.deploy(
      otocoMaster.address,
      gnosisSafe.address,
      gnosisSafeProxyFactory.address,
      [1],
      [gnosisSafe.address]
    );

    expect(await multisigPlugin.multisigPerEntity(1)).to.be.equals(1);

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
    transaction = await multisigPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
    const multisigAddress = (await transaction.wait()).events[2].args.multisig;
    await expect(transaction).to.emit(multisigPlugin, 'MultisigAdded').withArgs(0, multisigAddress);
    await expect(multisigPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay })).to.emit(multisigPlugin, 'MultisigAdded')

    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(2);

    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equals(prevBalance.add(amountToPay).add(amountToPay));

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet3).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.revertedWithCustomError(multisigPlugin, 'Unauthorized');

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: 0 }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(2);
    expect(await multisigPlugin.multisigDeployed(0, 0)).to.be.equals(multisigAddress);

    encoded = ethers.utils.defaultAbiCoder.encode(['address'], [multisigAddress]);
    transaction = await multisigPlugin.connect(wallet2).attachPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay })
    await expect(transaction).to.emit(multisigPlugin, 'MultisigAdded').withArgs(0, multisigAddress);

    await expect(multisigPlugin.attachPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.revertedWithCustomError(multisigPlugin, 'Unauthorized');

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet2).attachPlugin(0, encoded, { gasPrice, gasLimit, value: 0 }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(3);
    expect(await multisigPlugin.multisigDeployed(0, 0)).to.be.equals(multisigAddress);

    // Test removePlugin - the function expects just the index to remove
    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [1]);
    const secondMultisig = await multisigPlugin.multisigDeployed(0, 1);
    transaction = await multisigPlugin.connect(wallet2).removePlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
    await expect(transaction).to.emit(multisigPlugin, 'MultisigRemoved').withArgs(0, secondMultisig);

    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(2);

    // Test that unauthorized user cannot remove
    await expect(multisigPlugin.connect(wallet3).removePlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.revertedWithCustomError(multisigPlugin, 'Unauthorized');

    // Test that insufficient payment is rejected
    await expect(multisigPlugin.connect(wallet2).removePlugin(0, encoded, { gasPrice, gasLimit, value: 0 }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    // Test removing an invalid index should revert
    const invalidEncoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [999]);
    await expect(multisigPlugin.connect(wallet2).removePlugin(0, invalidEncoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.reverted;

  });

  it("Test multisig array management and ordering", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    // Deploy fresh plugin for this test
    const MultisigPluginFactory = await ethers.getContractFactory("MultisigV2");
    const testPlugin = await MultisigPluginFactory.deploy(
      otocoMaster.address,
      gnosisSafe.address,
      gnosisSafeProxyFactory.address,
      [],
      []
    );

    const encoded = gnosisSafeInterface.encodeFunctionData('setup', [
      [owner.address, wallet2.address],
      1,
      zeroAddress,
      [],
      zeroAddress,
      zeroAddress,
      0,
      zeroAddress
    ]);

    // Add 4 multisigs to series 0
    const addedMultisigs = [];
    for (let i = 0; i < 4; i++) {
      const tx = await testPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
      const receipt = await tx.wait();
      const multisigAddr = receipt.events[2].args.multisig;
      addedMultisigs.push(multisigAddr);
    }

    // Verify all 4 are added
    expect(await testPlugin.multisigPerEntity(0)).to.be.equals(4);
    for (let i = 0; i < 4; i++) {
      expect(await testPlugin.multisigDeployed(0, i)).to.be.equals(addedMultisigs[i]);
    }

    // Remove index 1 (second element)
    let removeEncoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [1]);
    await testPlugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay });

    // After removing index 1, the last element (index 3) should now be at index 1
    expect(await testPlugin.multisigPerEntity(0)).to.be.equals(3);
    expect(await testPlugin.multisigDeployed(0, 0)).to.be.equals(addedMultisigs[0]); // unchanged
    expect(await testPlugin.multisigDeployed(0, 1)).to.be.equals(addedMultisigs[3]); // last moved here
    expect(await testPlugin.multisigDeployed(0, 2)).to.be.equals(addedMultisigs[2]); // unchanged

    // Remove index 0 (first element)
    removeEncoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [0]);
    await testPlugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay });

    // After removing index 0, the last element (index 2) should now be at index 0
    expect(await testPlugin.multisigPerEntity(0)).to.be.equals(2);
    expect(await testPlugin.multisigDeployed(0, 0)).to.be.equals(addedMultisigs[2]); // last moved here
    expect(await testPlugin.multisigDeployed(0, 1)).to.be.equals(addedMultisigs[3]); // unchanged

    // Remove the last remaining element twice
    removeEncoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [1]);
    await testPlugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay });
    expect(await testPlugin.multisigPerEntity(0)).to.be.equals(1);

    removeEncoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [0]);
    await testPlugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay });
    expect(await testPlugin.multisigPerEntity(0)).to.be.equals(0);

    // Try to remove from empty array - should revert
    await expect(testPlugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.reverted;
  });

  it("Test that created multisigs are functional", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const encoded = gnosisSafeInterface.encodeFunctionData('setup', [
      [wallet2.address, wallet3.address],
      2, // require 2 signatures
      zeroAddress,
      [],
      zeroAddress,
      zeroAddress,
      0,
      zeroAddress
    ]);

    // Create a multisig through the plugin
    const tx = await multisigPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
    const receipt = await tx.wait();
    const multisigAddr = receipt.events[2].args.multisig;

    // Connect to the created multisig
    const GnosisSafeArtifact = await utils.getExternalArtifact("GnosisSafe");
    const multisig = await ethers.getContractAt(GnosisSafeArtifact.abi, multisigAddr);

    // Verify the multisig is properly configured
    expect(await multisig.getThreshold()).to.be.equals(2);
    const owners = await multisig.getOwners();
    expect(owners.length).to.be.equals(2);
    expect(owners).to.include(wallet2.address);
    expect(owners).to.include(wallet3.address);

    // Verify it's a valid Gnosis Safe by checking a method exists
    expect(await multisig.VERSION()).to.not.be.undefined;
  });

  it("Test attachPlugin with various scenarios", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    // Deploy a standalone multisig
    const GnosisSafeArtifact = await utils.getExternalArtifact("GnosisSafe");
    const setupData = gnosisSafeInterface.encodeFunctionData('setup', [
      [wallet2.address],
      1,
      zeroAddress,
      [],
      zeroAddress,
      zeroAddress,
      0,
      zeroAddress
    ]);
    
    const createTx = await gnosisSafeProxyFactory.createProxyWithNonce(gnosisSafe.address, setupData, 999999);
    const createReceipt = await createTx.wait();
    const standaloneMultisig = createReceipt.events[1].args[0];

    // Attach it to series 0
    const attachEncoded = ethers.utils.defaultAbiCoder.encode(['address'], [standaloneMultisig]);
    const currentCount = await multisigPlugin.multisigPerEntity(0);
    
    const tx = await multisigPlugin.connect(wallet2).attachPlugin(0, attachEncoded, { gasPrice, gasLimit, value: amountToPay });
    await expect(tx).to.emit(multisigPlugin, 'MultisigAdded').withArgs(0, standaloneMultisig);

    // Verify it was added
    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(currentCount.add(1));
    const lastIndex = (await multisigPlugin.multisigPerEntity(0)).toNumber() - 1;
    expect(await multisigPlugin.multisigDeployed(0, lastIndex)).to.be.equals(standaloneMultisig);

    // Test attaching zero address should work (no validation in contract)
    const zeroEncoded = ethers.utils.defaultAbiCoder.encode(['address'], [zeroAddress]);
    await expect(multisigPlugin.connect(wallet2).attachPlugin(0, zeroEncoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.emit(multisigPlugin, 'MultisigAdded').withArgs(0, zeroAddress);
  });


  it("Test multiple series isolation", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    // Deploy fresh plugin
    const MultisigPluginFactory = await ethers.getContractFactory("MultisigV2");
    const testPlugin = await MultisigPluginFactory.deploy(
      otocoMaster.address,
      gnosisSafe.address,
      gnosisSafeProxyFactory.address,
      [],
      []
    );

    const encoded = gnosisSafeInterface.encodeFunctionData('setup', [
      [owner.address, wallet2.address],
      1,
      zeroAddress,
      [],
      zeroAddress,
      zeroAddress,
      0,
      zeroAddress
    ]);

    // Add multisigs to series 0
    const tx1 = await testPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
    const series0Multisig1 = (await tx1.wait()).events[2].args.multisig;
    
    const tx2 = await testPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
    const series0Multisig2 = (await tx2.wait()).events[2].args.multisig;

    // Add multisig to series 1
    const tx3 = await testPlugin.connect(wallet3).addPlugin(1, encoded, { gasPrice, gasLimit, value: amountToPay });
    const series1Multisig = (await tx3.wait()).events[2].args.multisig;

    // Verify counts
    expect(await testPlugin.multisigPerEntity(0)).to.be.equals(2);
    expect(await testPlugin.multisigPerEntity(1)).to.be.equals(1);

    // Verify addresses are stored in the correct series
    expect(await testPlugin.multisigDeployed(0, 0)).to.be.equals(series0Multisig1);
    expect(await testPlugin.multisigDeployed(0, 1)).to.be.equals(series0Multisig2);
    expect(await testPlugin.multisigDeployed(1, 0)).to.be.equals(series1Multisig);

    // Remove from series 0 shouldn't affect series 1
    const removeEncoded = ethers.utils.defaultAbiCoder.encode(['uint256'], [0]);
    await testPlugin.connect(wallet2).removePlugin(0, removeEncoded, { gasPrice, gasLimit, value: amountToPay });

    expect(await testPlugin.multisigPerEntity(0)).to.be.equals(1);
    expect(await testPlugin.multisigPerEntity(1)).to.be.equals(1); // unchanged
    expect(await testPlugin.multisigDeployed(1, 0)).to.be.equals(series1Multisig); // unchanged
  });

  it("Test createProxyWithNonce generates unique addresses", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("6000000");
    const otocoBaseFee = await otocoMaster.baseFee();
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const encoded = gnosisSafeInterface.encodeFunctionData('setup', [
      [owner.address, wallet2.address],
      1,
      zeroAddress,
      [],
      zeroAddress,
      zeroAddress,
      0,
      zeroAddress
    ]);

    // Create 3 multisigs with the same setup data but they should have different addresses
    const addresses = new Set();
    for (let i = 0; i < 3; i++) {
      const tx = await multisigPlugin.connect(wallet2).addPlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
      const receipt = await tx.wait();
      const multisigAddr = receipt.events[2].args.multisig;
      addresses.add(multisigAddr);
    }

    // All addresses should be unique (nonce is based on seriesId * 1e18 + block.number)
    expect(addresses.size).to.be.equals(3);
  });

  it("Test owner-only functions", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    // Non-owner cannot update Gnosis master copy
    await expect(multisigPlugin.connect(wallet2).updateGnosisMasterCopy(wallet4.address))
      .to.be.revertedWith('Ownable: caller is not the owner');

    // Non-owner cannot update Gnosis proxy factory
    await expect(multisigPlugin.connect(wallet2).updateGnosisProxyFactory(wallet4.address))
      .to.be.revertedWith('Ownable: caller is not the owner');

    // Owner can update both
    await expect(multisigPlugin.updateGnosisMasterCopy(wallet4.address))
      .to.not.be.reverted;
    expect(await multisigPlugin.gnosisMasterCopy()).to.be.equals(wallet4.address);

    await expect(multisigPlugin.updateGnosisProxyFactory(wallet4.address))
      .to.not.be.reverted;
    expect(await multisigPlugin.gnosisProxyFactory()).to.be.equals(wallet4.address);

    // Restore original values
    await multisigPlugin.updateGnosisMasterCopy(gnosisSafe.address);
    await multisigPlugin.updateGnosisProxyFactory(gnosisSafeProxyFactory.address);
  });


  const migrationData = {
    "timestamp": "2025-08-20T13:14:40.059Z",
    "totalEvents": 5,
    "events": [
      {
        "series": "0",
        "multisig": "0xeb5E2602BE0FEcDAeA1D930f58cac507E966e34C",
      },
      {
        "series": "0",
        "multisig": "0x38033b97c7777B7530265e0f47D1681E2485E41f",
      },
      {
        "series": "19",
        "multisig": "0x38033b97c7777B7530265e0f47D1681E2485E41f",
      },
      {
        "series": "26",
        "multisig": "0xce62EA2DD5d1C31130FBe5Ba95f8534b6904c9C3",
      },
      {
        "series": "36",
        "multisig": "0xc0d3794825040f36b68185E394c00912a6DDD81F",
      }
    ]
  }

  it("Deploy plugin with migration data", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const MultisigPluginFactory = await ethers.getContractFactory("MultisigV2");
    const multisigPlugin = await MultisigPluginFactory.deploy(
      otocoMaster.address,
      gnosisSafe.address,
      gnosisSafeProxyFactory.address,
      migrationData.events.map(e => e.series),
      migrationData.events.map(e => e.multisig)
    );
    // Test that multisigPerEntity is correctly set for each series
    // Series 0 should have 2 multisigs, others should have 1
    expect(await multisigPlugin.multisigPerEntity(0)).to.be.equals(2);
    expect(await multisigPlugin.multisigPerEntity(19)).to.be.equals(1);
    expect(await multisigPlugin.multisigPerEntity(26)).to.be.equals(1);
    expect(await multisigPlugin.multisigPerEntity(36)).to.be.equals(1);

    // Test specific order for series 0 (which has 2 multisigs)
    expect(await multisigPlugin.multisigDeployed(0, 0)).to.be.equals("0xeb5E2602BE0FEcDAeA1D930f58cac507E966e34C");
    expect(await multisigPlugin.multisigDeployed(0, 1)).to.be.equals("0x38033b97c7777B7530265e0f47D1681E2485E41f");

    // Test that multisigDeployed mapping is correctly populated
    // Group events by series to handle multiple multisigs per series
    const eventsBySeries = {};
    migrationData.events.forEach((event, index) => {
      const seriesId = event.series;
      if (!eventsBySeries[seriesId]) {
        eventsBySeries[seriesId] = [];
      }
      eventsBySeries[seriesId].push(event);
    });

    // Check each series and its multisigs
    for (const [seriesId, seriesEvents] of Object.entries(eventsBySeries)) {
      for (let i = 0; i < seriesEvents.length; i++) {
        const expectedMultisig = seriesEvents[i].multisig;
        const actualMultisig = await multisigPlugin.multisigDeployed(seriesId, i);
        expect(actualMultisig).to.be.equals(expectedMultisig);
      }
    }

    // Test series that don't have migration data
    expect(await multisigPlugin.multisigPerEntity(999)).to.be.equals(0);

    // Test that all migration data is accessible
    const allSeriesIds = migrationData.events.map(e => parseInt(e.series));
    const uniqueSeriesIds = [...new Set(allSeriesIds)];

    for (const seriesId of uniqueSeriesIds) {
      const count = await multisigPlugin.multisigPerEntity(seriesId);
      const eventsForSeries = migrationData.events.filter(e => parseInt(e.series) === seriesId);
      expect(count).to.be.equals(eventsForSeries.length);
    }

  });

});