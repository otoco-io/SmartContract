const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
chai.use(solidity);

const { Artifacts } = require("hardhat/internal/artifacts");
const { zeroAddress } = require("ethereumjs-util");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

describe("OtoCo Launchpool and Token Plugins Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let tokenPlugin;
  let tokenAddress;
  let TokenFactory;

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

  it("Deploy and remove Token plugin", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("350000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    TokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await TokenFactory.deploy();
    expect(await token.name()).to.be.equal("");
    expect(await token.symbol()).to.be.equal("");
    
    expect(await token.name()).to.be.equal("");
    expect(await token.symbol()).to.be.equal("");

    const TokenPluginFactory = await ethers.getContractFactory("Token");
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

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    //console.log((await transaction.wait()).events)
    tokenAddress = (await transaction.wait()).events[1].args.token;
    const tokenDeployed = TokenFactory.attach(tokenAddress);
    
    expect(await tokenDeployed.name()).to.be.equal("Test Token");
    expect(await tokenDeployed.symbol()).to.be.equal("TTOK");
    expect(await tokenDeployed.totalSupply()).to.be.equal(ethers.utils.parseEther('8000000'));
    expect(await tokenPlugin.tokensPerEntity(0)).to.be.equals(1);
    expect(await tokenPlugin.tokensDeployed(0,0)).to.be.equals(tokenAddress);
    
    await expect(tokenDeployed.initialize('', '', "100", zeroAddress()))
    .to.be.revertedWith('Initializable: contract is already initialized');

    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    transaction = await tokenPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenRemoved').withArgs(0, tokenAddress);

    encoded = ethers.utils.defaultAbiCoder.encode(['address'],[tokenAddress]);
    transaction = await tokenPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet3).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet3).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

     // Create DAI token to use as payment on launchpool
    encoded = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'string', 'string', 'address'],
      [ethers.utils.parseEther('8000000'), 'Test DAI', 'DAI', owner.address]
    );
    await expect(tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    // Create USDC token to use as payment on launchpool
    encoded = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'string', 'string', 'address'],
      [ethers.utils.parseEther('8000000'), 'Test USDC', 'USDC', owner.address]
    );
    await expect(tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    // Create USDT token to use as payment on launchpool
    encoded = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'string', 'string', 'address'],
      [ethers.utils.parseEther('8000000'), 'Test Token', 'USDT', owner.address]
    );
    await expect(tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))

    await expect(tokenPlugin.connect(wallet2).updateTokenContract(zeroAddress()))
    .to.be.revertedWith('Ownable: caller is not the owner');

     await tokenPlugin.updateTokenContract(zeroAddress())
     expect(await tokenPlugin.tokenContract()).to.be.equal(zeroAddress());
  });

  it("Deploy and remove Launchpool plugin", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("2000000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    const LaunchPoolArtifact = await getExternalArtifact("LaunchPool");
    const LaunchPoolFactory = await ethers.getContractFactoryFromArtifact(LaunchPoolArtifact);
    const launchpool = await LaunchPoolFactory.deploy();

    const LaunchCurveArtifact = await getExternalArtifact("LaunchCurveExponential");
    const LaunchCurveFactory = await ethers.getContractFactoryFromArtifact(LaunchCurveArtifact);
    const launchcurve = await LaunchCurveFactory.deploy();

    const LaunchPoolPluginFactory = await ethers.getContractFactory("Launchpool");
    launchPoolPlugin = await LaunchPoolPluginFactory.deploy(
        otocoMaster.address,
        launchpool.address,
        launchcurve.address,
        [1],
        [launchpool.address]
    );
    
    let transaction = await launchPoolPlugin.addCurveSource(launchcurve.address);

    await expect(launchPoolPlugin.connect(wallet2).addCurveSource(launchcurve.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    transaction = await launchPoolPlugin.updatePoolSource(launchpool.address);

    await expect(launchPoolPlugin.connect(wallet2).updatePoolSource(launchpool.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    const paymentToken1 = await tokenPlugin.tokensDeployed(0,1);
    const paymentToken2 = await tokenPlugin.tokensDeployed(0,2);
    const paymentToken3 = await tokenPlugin.tokensDeployed(0,3);

    encoded = ethers.utils.defaultAbiCoder.encode(
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

    // There's no Attach function at Launchpool plugin
    await expect(launchPoolPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Attach elements are not possible on this plugin.');

    // There's no Attach function at Launchpool plugin
    await expect(launchPoolPlugin.connect(wallet3).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(launchPoolPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    transaction = await launchPoolPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(launchPoolPlugin, 'LaunchpoolRemoved').withArgs(0, launchpoolAddress);

    // There's no Attach function at Launchpool plugin
    await expect(launchPoolPlugin.connect(wallet3).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay}))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(launchPoolPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:0}))
    .to.be.revertedWith('OtoCoMaster: Not enough ETH paid for the execution.');

    // Test Migrated address 
    expect(await launchPoolPlugin.launchpoolDeployed(1)).to.be.equal(launchpool.address)

  });

});