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

  it("Deploy plugin, add and remove", async function () {
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

    encoded = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [0, 1]);
    transaction = await multisigPlugin.connect(wallet2).removePlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay });
    await expect(transaction).to.emit(multisigPlugin, 'MultisigRemoved').withArgs(0, multisigAddress);

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet3).removePlugin(0, encoded, { gasPrice, gasLimit, value: amountToPay }))
      .to.be.revertedWithCustomError(multisigPlugin, 'Unauthorized');

    // There's no Attach function at Launchpool plugin
    await expect(multisigPlugin.connect(wallet2).removePlugin(0, encoded, { gasPrice, gasLimit, value: 0 }))
      .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

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

    // Test that MultisigAdded events were emitted for all migration data
    // for (let i = 0; i < migrationData.events.length; i++) {
    //   const event = migrationData.events[i];
    //   await expect(deployTransaction).to.emit(multisigPlugin, 'MultisigAdded')
    //     .withArgs(event.series, event.multisig);
    // }

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