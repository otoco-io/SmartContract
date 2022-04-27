const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
chai.use(solidity);

const { Artifacts } = require("hardhat/internal/artifacts");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

describe("OtoCo Token, Timestamp, Launchpool Plugins Test", function () {

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
  });

  it("Deploy and remove Token plugin", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("350000");
    const otocoBaseFee = await otocoMaster.baseFee();

    const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

    TokenFactory = await ethers.getContractFactory("OtoCoToken");
    tokenPlugin = await TokenFactory.deploy();

    const TokenPluginFactory = await ethers.getContractFactory("Token");
    tokenPlugin = await TokenPluginFactory.deploy(otocoMaster.address, tokenPlugin.address, [], []);
    
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('8000000'), 'Test Token', 'TTOK', wallet2.address]
    );
    const prevBalance = await ethers.provider.getBalance(otocoMaster.address);
    let transaction = await tokenPlugin.connect(wallet2).addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equals(prevBalance.add(amountToPay));

    //console.log((await transaction.wait()).events)
    tokenAddress = (await transaction.wait()).events[2].args.token;
    const tokenDeployed = TokenFactory.attach(tokenAddress);
    
    expect(await tokenDeployed.name()).to.be.equal("Test Token");
    expect(await tokenDeployed.symbol()).to.be.equal("TTOK");
    expect(await tokenDeployed.totalSupply()).to.be.equal(ethers.utils.parseEther('8000000'));
    expect(await tokenPlugin.tokensPerEntity(0)).to.be.equals(1);
    expect(await tokenPlugin.tokensDeployed(0,0)).to.be.equals(tokenAddress);
    
    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    transaction = await tokenPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenRemoved').withArgs(0, tokenAddress);

    encoded = ethers.utils.defaultAbiCoder.encode(['address'],[tokenAddress]);
    transaction = await tokenPlugin.connect(wallet2).attachPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');
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
        [],
        []
    );
    
    let transaction = await launchPoolPlugin.addCurveSource(launchcurve.address);

    await expect(launchPoolPlugin.connect(wallet2).addCurveSource(launchcurve.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    transaction = await launchPoolPlugin.updatePoolSource(launchpool.address);

    await expect(launchPoolPlugin.connect(wallet2).updatePoolSource(launchpool.address))
    .to.be.revertedWith('Ownable: caller is not the owner');

    const paymentToken1 = await TokenFactory.deploy();
    paymentToken1.initialize('Test DAI', 'DAI', ethers.utils.parseEther('8000000'), owner.address);
    const paymentToken2 = await TokenFactory.deploy();
    paymentToken2.initialize('Test USDC', 'USDC', ethers.utils.parseEther('8000000'), owner.address);
    const paymentToken3 = await TokenFactory.deploy();
    paymentToken3.initialize('Test USDT', 'USDT', ethers.utils.parseEther('8000000'), owner.address);

    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'string', 'address', 'uint16', 'address'],
        [
            [paymentToken1.address, paymentToken2.address, paymentToken3.address],
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

    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    transaction = await launchPoolPlugin.connect(wallet2).removePlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay});
    await expect(transaction).to.emit(launchPoolPlugin, 'LaunchpoolRemoved').withArgs(0, launchpoolAddress);

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

  });

});