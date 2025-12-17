const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");


describe("OtoCo TokenV2 Plugin Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let tokenPlugin;
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

  it("Deploy and test TokenV2 plugin", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("350000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    TokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await TokenFactory.deploy();
    expect(await token.name()).to.be.equal("");
    expect(await token.symbol()).to.be.equal("");
    
    const TokenPluginFactory = await ethers.getContractFactory("TokenV2");
    tokenPlugin = await TokenPluginFactory.deploy(
        otocoMaster.address,
        token.address,
        [1],
        [token.address]
    );
    
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('8000000'), 'Test Token', 'TTOK', wallet2.address]
    );
    const prevBalance = await ethers.provider.getBalance(otocoMaster.address);
    let transaction = await tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equals(prevBalance.add(amountToPay));

    // Test unauthorized access
    await expect(tokenPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(tokenPlugin, 'Unauthorized');

    // Test insufficient ETH paid
    await expect(tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWithCustomError(otocoMaster, 'InsufficientValue');

    tokenAddress = (await transaction.wait()).events[2].args.token;
    const tokenDeployed = TokenFactory.attach(tokenAddress);
    
    expect(await tokenDeployed.name()).to.be.equal("Test Token");
    expect(await tokenDeployed.symbol()).to.be.equal("TTOK");
    expect(await tokenDeployed.totalSupply()).to.be.equal(ethers.utils.parseEther('8000000'));
    expect(await tokenPlugin.tokensPerEntity(0)).to.be.equals(1);
    expect(await tokenPlugin.tokensDeployed(0,0)).to.be.equals(tokenAddress);
    
    await expect(tokenDeployed.initialize('', '', "100", zeroAddress))
    .to.be.revertedWith('Initializable: contract is already initialized');

    // Test removePlugin
    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    transaction = await tokenPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenRemoved').withArgs(0, tokenAddress);

    // Test attachPlugin
    encoded = ethers.utils.defaultAbiCoder.encode(['address'],[tokenAddress]);
    transaction = await tokenPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');

    // Test unauthorized access for attach
    await expect(tokenPlugin.connect(wallet3).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(tokenPlugin, 'Unauthorized');

    // Test insufficient ETH paid for attach
    await expect(tokenPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWithCustomError(otocoMaster, 'InsufficientValue');

    // Test unauthorized access for remove
    await expect(tokenPlugin.connect(wallet3).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWithCustomError(tokenPlugin, 'Unauthorized');

    // Test insufficient ETH paid for remove
    await expect(tokenPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWithCustomError(otocoMaster, 'InsufficientValue');

    // Test updateTokenContract - only owner
    await expect(tokenPlugin.connect(wallet2).updateTokenContract(zeroAddress))
    .to.be.revertedWith('Ownable: caller is not the owner');

    await tokenPlugin.updateTokenContract(zeroAddress)
    expect(await tokenPlugin.tokenContract()).to.be.equal(zeroAddress);
  });

  it("Deploy plugin with migration data", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    TokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await TokenFactory.deploy();

    const TokenPluginFactory = await ethers.getContractFactory("TokenV2");
    
    // Create plugin with migration data
    const migrationPlugin = await TokenPluginFactory.deploy(
        otocoMaster.address,
        token.address,
        [0, 0, 1, 2],
        [token.address, token.address, token.address, token.address]
    );

    // Verify migration data was loaded correctly
    expect(await migrationPlugin.tokensPerEntity(0)).to.be.equals(2);
    expect(await migrationPlugin.tokensPerEntity(1)).to.be.equals(1);
    expect(await migrationPlugin.tokensPerEntity(2)).to.be.equals(1);
    
    // Verify token addresses
    expect(await migrationPlugin.tokensDeployed(0, 0)).to.be.equals(token.address);
    expect(await migrationPlugin.tokensDeployed(0, 1)).to.be.equals(token.address);
    expect(await migrationPlugin.tokensDeployed(1, 0)).to.be.equals(token.address);
    expect(await migrationPlugin.tokensDeployed(2, 0)).to.be.equals(token.address);
  });

  it("Test multiple tokens per entity", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("350000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    TokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await TokenFactory.deploy();

    const TokenPluginFactory = await ethers.getContractFactory("TokenV2");
    const plugin = await TokenPluginFactory.deploy(
        otocoMaster.address,
        token.address,
        [],
        []
    );

    // Add first token
    let encoded1 = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('1000'), 'Token One', 'TK1', wallet2.address]
    );
    await plugin.connect(wallet2).addPlugin(0, encoded1, {gasPrice, gasLimit, value:amountToPay});

    // Add second token
    let encoded2 = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('2000'), 'Token Two', 'TK2', wallet2.address]
    );
    await plugin.connect(wallet2).addPlugin(0, encoded2, {gasPrice, gasLimit, value:amountToPay});

    // Add third token
    let encoded3 = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('3000'), 'Token Three', 'TK3', wallet2.address]
    );
    await plugin.connect(wallet2).addPlugin(0, encoded3, {gasPrice, gasLimit, value:amountToPay});

    expect(await plugin.tokensPerEntity(0)).to.be.equals(3);

    // Remove middle token
    let encodedRemove = ethers.utils.defaultAbiCoder.encode(['uint256'],[1]);
    await plugin.connect(wallet2).removePlugin(0, encodedRemove, {gasPrice, gasLimit, value:amountToPay});

    expect(await plugin.tokensPerEntity(0)).to.be.equals(2);
  });

});
