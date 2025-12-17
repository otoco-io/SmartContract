const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const utils = require('./utils');


describe("OtoCo LaunchpoolV2 Plugin Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let tokenPlugin;
  let launchPoolPlugin;
  let tokenAddress;
  let TokenFactory;
  let priceFeed;

  const zeroAddress = ethers.constants.AddressZero;

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

    // Deploy and set price feed (required for V2)
    const PriceFeed = await ethers.getContractFactory("MockAggregatorV3");
    priceFeed = await PriceFeed.deploy();
    await otocoMaster.changePriceFeed(priceFeed.address);

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPayForSpinUp = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    // Expected to successfully create a new entity
    await otocoMaster.connect(wallet2).createSeries(2, wallet2.address, "New Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
    // Expect to create another entity
    await otocoMaster.connect(wallet3).createSeries(1, wallet3.address, "Another Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
  });

  it("Deploy Token plugin and create payment tokens", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("350000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    TokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await TokenFactory.deploy();

    const TokenPluginFactory = await ethers.getContractFactory("TokenV2");
    tokenPlugin = await TokenPluginFactory.deploy(
        otocoMaster.address,
        token.address,
        [],
        []
    );
    
    // Create main token for shares
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('8000000'), 'Test Token', 'TTOK', wallet2.address]
    );
    let transaction = await tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    tokenAddress = (await transaction.wait()).events[2].args.token;

    // Create DAI token to use as payment on launchpool
    encoded = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'string', 'string', 'address'],
      [ethers.utils.parseEther('8000000'), 'Test DAI', 'DAI', owner.address]
    );
    await tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay})
    
    // Create USDC token to use as payment on launchpool
    encoded = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'string', 'string', 'address'],
      [ethers.utils.parseEther('8000000'), 'Test USDC', 'USDC', owner.address]
    );
    await tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay})
    
    // Create USDT token to use as payment on launchpool
    encoded = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'string', 'string', 'address'],
      [ethers.utils.parseEther('8000000'), 'Test USDT', 'USDT', owner.address]
    );
    await tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay})
  });

  it("Deploy and test LaunchpoolV2 plugin", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("2000000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const LaunchPoolArtifact = await utils.getExternalArtifact("LaunchPool");
    const LaunchPoolFactory = await ethers.getContractFactoryFromArtifact(LaunchPoolArtifact);
    const launchpool = await LaunchPoolFactory.deploy();

    const LaunchCurveArtifact = await utils.getExternalArtifact("LaunchCurveExponential");
    const LaunchCurveFactory = await ethers.getContractFactoryFromArtifact(LaunchCurveArtifact);
    const launchcurve = await LaunchCurveFactory.deploy();

    const LaunchPoolPluginFactory = await ethers.getContractFactory("LaunchpoolV2");
    launchPoolPlugin = await LaunchPoolPluginFactory.deploy(
        otocoMaster.address,
        launchpool.address,
        launchcurve.address,
        [1],
        [launchpool.address]
    );
    
    // Test addCurveSource
    let transaction = await launchPoolPlugin.addCurveSource(launchcurve.address);

    await expect(launchPoolPlugin.connect(wallet2).addCurveSource(launchcurve.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    // Test updatePoolSource
    transaction = await launchPoolPlugin.updatePoolSource(launchpool.address);

    await expect(launchPoolPlugin.connect(wallet2).updatePoolSource(launchpool.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    const paymentToken1 = await tokenPlugin.tokensDeployed(0,1);
    const paymentToken2 = await tokenPlugin.tokensDeployed(0,2);
    const paymentToken3 = await tokenPlugin.tokensDeployed(0,3);

    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'string', 'address', 'uint16', 'address'],
        [
            [paymentToken1, paymentToken2, paymentToken3],
            [
                ethers.utils.parseUnits('100', 'wei'),
                ethers.utils.parseUnits('5000000', 'wei'),
                0,
                parseInt(Date.now()*0.001) + 1000,
                10,
                1000,
                ethers.utils.parseUnits('1','ether'),
                ethers.utils.parseUnits('5000000', 'wei')
            ],
            'QmZuQMs9n2TJUsV2VyGHox5wwxNAg3FVr5SWRKU814DCra',
            tokenAddress,
            0,
            wallet2.address
        ]
    );
    const prevBalance = await ethers.provider.getBalance(otocoMaster.address);
    transaction = await launchPoolPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(launchPoolPlugin, 'LaunchpoolCreated');
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equals(prevBalance.add(amountToPay));

    const launchpoolAddress = await launchPoolPlugin.launchpoolDeployed(0);

    // Test that attachPlugin is not allowed
    await expect(launchPoolPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(launchPoolPlugin, 'AttachNotAllowed');

    // Test unauthorized access
    await expect(launchPoolPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(launchPoolPlugin, 'Unauthorized');

    // Test insufficient ETH paid
    await expect(launchPoolPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWithCustomError(otocoMaster, 'InsufficientValue');

    // Test removePlugin
    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    transaction = await launchPoolPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(launchPoolPlugin, 'LaunchpoolRemoved').withArgs(0, launchpoolAddress);

    // Test unauthorized access for remove
    await expect(launchPoolPlugin.connect(wallet3).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(launchPoolPlugin, 'Unauthorized');

    // Test insufficient ETH paid for remove
    await expect(launchPoolPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWithCustomError(otocoMaster, 'InsufficientValue');

    // Test Migrated address 
    expect(await launchPoolPlugin.launchpoolDeployed(1)).to.be.equal(launchpool.address)
  });

  it("Deploy plugin with migration data", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const LaunchPoolArtifact = await utils.getExternalArtifact("LaunchPool");
    const LaunchPoolFactory = await ethers.getContractFactoryFromArtifact(LaunchPoolArtifact);
    const launchpool = await LaunchPoolFactory.deploy();

    const LaunchCurveArtifact = await utils.getExternalArtifact("LaunchCurveExponential");
    const LaunchCurveFactory = await ethers.getContractFactoryFromArtifact(LaunchCurveArtifact);
    const launchcurve = await LaunchCurveFactory.deploy();

    const LaunchPoolPluginFactory = await ethers.getContractFactory("LaunchpoolV2");
    
    // Deploy with migration data
    const pluginWithMigration = await LaunchPoolPluginFactory.deploy(
        otocoMaster.address,
        launchpool.address,
        launchcurve.address,
        [0, 1, 2],
        [launchpool.address, launchpool.address, launchpool.address]
    );

    // Verify migration data
    expect(await pluginWithMigration.launchpoolDeployed(0)).to.be.equal(launchpool.address);
    expect(await pluginWithMigration.launchpoolDeployed(1)).to.be.equal(launchpool.address);
    expect(await pluginWithMigration.launchpoolDeployed(2)).to.be.equal(launchpool.address);
  });

  it("Test multiple curve sources", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const LaunchPoolArtifact = await utils.getExternalArtifact("LaunchPool");
    const LaunchPoolFactory = await ethers.getContractFactoryFromArtifact(LaunchPoolArtifact);
    const launchpool = await LaunchPoolFactory.deploy();

    const LaunchCurveArtifact = await utils.getExternalArtifact("LaunchCurveExponential");
    const LaunchCurveFactory = await ethers.getContractFactoryFromArtifact(LaunchCurveArtifact);
    const launchcurve1 = await LaunchCurveFactory.deploy();
    const launchcurve2 = await LaunchCurveFactory.deploy();

    const LaunchPoolPluginFactory = await ethers.getContractFactory("LaunchpoolV2");
    const plugin = await LaunchPoolPluginFactory.deploy(
        otocoMaster.address,
        launchpool.address,
        launchcurve1.address,
        [],
        []
    );

    // Add second curve
    await plugin.addCurveSource(launchcurve2.address);

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("2000000");
    const otocoBaseFee = await otocoMaster.baseFee();
    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const paymentToken1 = await tokenPlugin.tokensDeployed(0,1);

    // Create launchpool with curve index 1 (second curve)
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'string', 'address', 'uint16', 'address'],
        [
            [paymentToken1],
            [
                ethers.utils.parseUnits('100', 'wei'),
                ethers.utils.parseUnits('5000000', 'wei'),
                0,
                parseInt(Date.now()*0.001) + 1000,
                10,
                1000,
                ethers.utils.parseUnits('1','ether'),
                ethers.utils.parseUnits('5000000', 'wei')
            ],
            'QmTestMetadata',
            tokenAddress,
            1,
            wallet2.address
        ]
    );
    
    let transaction = await plugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(plugin, 'LaunchpoolCreated');
  });

});
