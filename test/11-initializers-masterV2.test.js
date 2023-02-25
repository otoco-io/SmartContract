const hre = require('hardhat');
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { zeroAddress } = require("ethereumjs-util");
const { solidity,  deployMockContract } = require("ethereum-waffle");
const { Artifacts } = require("hardhat/internal/artifacts");
const chai = require("chai");
// const { ConsensusAlgorithm } = require("@ethereumjs/common");
chai.use(solidity);


async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}


const EthDividend = ethers.BigNumber.from(ethers.utils.parseUnits('1', 18)).mul(ethers.utils.parseUnits('1', 9)).div(10);

describe("OtoCo Master Test", function () {
  let owner, wallet2, wallet3, wallet4;
  let OtoCoMasterV2;
  let otocoMaster;
  let jurisdictions;
  let priceFeed;

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    
    const unincorporated = await Unincorporated.deploy(0, 2, 'DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy(5, 5, 'DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy(50, 40, 'WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address];
  });

  it("Initialize Master and add jurisdictions", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    OtoCoMasterV2 = await ethers.getContractFactory("OtoCoMasterV2");
    otocoMaster = await upgrades.deployProxy(OtoCoMasterV2, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    expect(await otocoMaster.name()).to.equal("OtoCo Series");
    expect(await otocoMaster.symbol()).to.equal("OTOCO");
    expect(await otocoMaster.owner()).to.equal(owner.address);
  });

  it("Check jurisdiction order and count", async function () {

    const unincorporated = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(0));
    const delaware = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(1));
    const wyoming = await ethers.getContractAt("OtoCoJurisdiction", await otocoMaster.jurisdictionAddress(2));

    expect(await otocoMaster.jurisdictionCount()).to.equal(3);

    expect(await unincorporated.getJurisdictionName()).to.equal("DAO");
    expect(await delaware.getJurisdictionName()).to.equal("DELAWARE");
    expect(await wyoming.getJurisdictionName()).to.equal("WYOMING");

  });

  it("Change payment fees and price feed source", async function () {
    // const otocoBaseFee = await otocoMaster.baseFee();
    expect(await otocoMaster.changeBaseFees("5000000000000000"))
    .to.emit(otocoMaster, "BaseFeeChanged")
    .withArgs("5000000000000000");
    expect(await otocoMaster.baseFee()).to.be.equal("5000000000000000");
    const PriceFeed = await ethers.getContractFactory("MockAggregatorV3");
    priceFeed = await PriceFeed.deploy();
    expect(await otocoMaster.changePriceFeed(priceFeed.address)).to.emit(otocoMaster, "UpdatedPriceFeed");

    await expect(otocoMaster.connect(wallet4).changeBaseFees("0"))
      .to.be.revertedWith('Ownable: caller is not the owner');
    await expect(otocoMaster.connect(wallet4).changePriceFeed(zeroAddress()))
      .to.be.revertedWith('Ownable: caller is not the owner');
  })

  it("Creating series with correct fees and wrong fees", async function () {

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("200000");
    // Check the amount of ETH has to be paid after pass the priceFeed
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    const amountToPayForSpinUp = EthDividend.div((await priceFeed.latestRoundData()).answer).mul(await wy.getJurisdictionDeployPrice());
    // Remove 1% from the correct amount needed
    const notEnoughToPayForSpinUp = amountToPayForSpinUp.mul(100).div(101);

    // Try to create without the proper amount of ETH Value, expect to fail
    await expect(otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:notEnoughToPayForSpinUp}))
    .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

    const previousBalance = await ethers.provider.getBalance(otocoMaster.address);

    // Expected to successfully create a new entity
    const transaction = await otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress(), owner.address, 0);
    expect((await otocoMaster.series(0)).jurisdiction).to.be.equal(2)
    expect((await otocoMaster.series(0)).name).to.be.equal("New Entity - Series 1")
    
    // Check if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(previousBalance.add(amountToPayForSpinUp));

  });

  it("Should create a new entity using Multisig initializer without plugins", async function () {

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("600000");
    // Check the amount of ETH has to be paid after pass the priceFeed
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    const baseFee = await otocoMaster.baseFee();
    const amountToPayForSpinUp = 
      EthDividend.div((await priceFeed.latestRoundData()).answer)
      .mul(await wy.getJurisdictionDeployPrice())
      .add(baseFee.mul(gasLimit));

    const GnosisSafeArtifact = await getExternalArtifact("GnosisSafe");
    const GnosisSafeFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
    gnosisSafe = await GnosisSafeFactory.deploy();

    const GnosisSafeProxyFactoryArtifact = await getExternalArtifact("GnosisSafeProxyFactory");
    const GnosisSafeProxyFactoryFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
    gnosisSafeProxyFactory = await GnosisSafeProxyFactoryFactory.deploy();

    gnosisSafeInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);
    const data = gnosisSafeInterface.encodeFunctionData('setup', [
        [owner.address, wallet2.address],
        1,
        zeroAddress(),
        [],
        zeroAddress(),
        zeroAddress(),
        0,
        zeroAddress()
    ]);

    const gnosisSafeFactoryInterface = new ethers.utils.Interface(GnosisSafeProxyFactoryArtifact.abi);
    const dataFactory = gnosisSafeFactoryInterface.encodeFunctionData('createProxy', [
      gnosisSafe.address,
      data
    ]);

    const initArgs =
      [ 
        2,
        [gnosisSafeProxyFactory.address],
        [dataFactory],
        0,
        "New Entity",
      ];

    const values = [
      // correct amount
    [{gasPrice, gasLimit, value:amountToPayForSpinUp}],
    // incorrect amount
    [{gasPrice, gasLimit, value:ethers.constants.Zero}],
  ];

  const fundedArgs = initArgs.concat(values[0]);
  const unfundedArgs = initArgs.concat(values[1]);
  const initError = fundedArgs.slice();
  initError.splice(1,1,[otocoMaster.address]);
  const initError2 = fundedArgs.slice();
  initError2.splice(1,1,[owner.address]);

    const transaction =
      await otocoMaster
      .createEntityWithInitializer(...fundedArgs);

    const proxyAddress = (await transaction.wait()).events.pop().args.to;
    await expect(transaction).to.emit(gnosisSafeProxyFactory, 'ProxyCreation').withArgs(proxyAddress, gnosisSafe.address)
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress(), proxyAddress, 1)
    
    const proxyInstance = await GnosisSafeFactory.attach(proxyAddress);
    expect(await proxyInstance.getOwners()).to.be.eql([owner.address, wallet2.address])

    await expect(otocoMaster.createEntityWithInitializer(...unfundedArgs))
      .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");
    
    await expect(otocoMaster.createEntityWithInitializer(...initError))
      .to.be.revertedWithCustomError(otocoMaster, "InitializerError");
    await expect(otocoMaster.createEntityWithInitializer(...initError2))
      .to.be.revertedWithCustomError(otocoMaster, "InitializerError");

  });

  it("Should create a new entity using Multisig initializer with plugins", async function () {
    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("600000");
    const Unincorporated = 
      await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const unc = Unincorporated.attach(await otocoMaster.jurisdictionAddress(0));
    const baseFee = await otocoMaster.baseFee();
    const amountToPayForSpinUp = 
      EthDividend.div((await priceFeed.latestRoundData()).answer)
      .mul(await unc.getJurisdictionDeployPrice())
      .add(baseFee.mul(gasLimit));

    const GnosisSafeArtifact = 
      await getExternalArtifact("GnosisSafe");
    const GnosisSafeFactory = 
      await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
    gnosisSafe = await GnosisSafeFactory.deploy();

    const GnosisSafeProxyFactoryArtifact = 
      await getExternalArtifact("GnosisSafeProxyFactory");
    const GnosisSafeProxyFactoryFactory = 
      await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
    gnosisSafeProxyFactory = await GnosisSafeProxyFactoryFactory.deploy();
    gnosisSafeInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);

    const data = gnosisSafeInterface.encodeFunctionData('setup', [
        [owner.address, wallet2.address],
        1,
        zeroAddress(),
        [],
        zeroAddress(),
        zeroAddress(),
        0,
        zeroAddress(),
    ]);

    const gnosisSafeFactoryInterface = 
      new ethers.utils.Interface(GnosisSafeProxyFactoryArtifact.abi);
    const dataFactory = 
      gnosisSafeFactoryInterface.encodeFunctionData(
        'createProxy', 
        [ gnosisSafe.address, data ],
    );

    // `gnosisSafeProxyFactory` returns a new address and all otoco v1 plugins' 
    // `addPlugin` functions require the msg.sender to be the owner of `seriesID`/`tokenId`.
    // Since this renders using v1 plugins unfeaseble and V2 plugins have not yet been released,
    // we will temporaly use dynamic mocking for the `IOtoCoPlugin` interface in order to cover
    // the branch designed to call `addPlugin` in otoco v2 plugins.

    const pluginABI = 
        (await hre.artifacts.readArtifact("IOtoCoPlugin")).abi;

    const mockData = 
      ethers.utils.defaultAbiCoder.encode(['string'],['mckd'],);

    const mockPlugin = await deployMockContract(owner, pluginABI);
    await mockPlugin.deployed();
    await mockPlugin.mock.addPlugin.withArgs(2,mockData).returns();

    const transaction = await otocoMaster.createEntityWithInitializer(
      0,
      [gnosisSafeProxyFactory.address, mockPlugin.address],
      [dataFactory, mockData],
      0,
      "New Entity 2",
      {gasPrice, gasLimit, value:amountToPayForSpinUp},
    );

    const proxyAddress = (await transaction.wait()).events.pop().args.to;
    const storageCheck =  
      [
        await otocoMaster.callStatic.seriesCount(), 
        await otocoMaster.callStatic.seriesPerJurisdiction(0),
        await otocoMaster.callStatic.ownerOf(2),
      ];


    expect(transaction).to.be.ok;
    expect(storageCheck[0]).to.eq(ethers.BigNumber.from(3));
    expect(storageCheck[1]).to.eq(ethers.constants.One);
    expect(storageCheck[2]).to.eq(proxyAddress);
    
    await expect(transaction).to.emit(gnosisSafeProxyFactory, 'ProxyCreation')
      .withArgs(proxyAddress, gnosisSafe.address);
    await expect(transaction).to.emit(otocoMaster, 'Transfer')
      .withArgs(zeroAddress(), proxyAddress, ethers.constants.Two);

  });

  it("Should create a new entity without initializer and without plugins", async function () {
    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("600000");
    const Delaware = 
      await ethers.getContractFactory("JurisdictionDelawareV2");
    const de = Delaware.attach(await otocoMaster.jurisdictionAddress(1));
    const baseFee = await otocoMaster.baseFee();
    const amountToPayForSpinUp = 
      EthDividend.div((await priceFeed.latestRoundData()).answer)
      .mul(await de.getJurisdictionDeployPrice())
      .add(baseFee.mul(gasLimit));

    const initArgs =
      [ 
        1,
        [zeroAddress()],
        [],
        0,
        "New Entity 3",
      ];

    const values = [
      // correct amount
      [{gasPrice, gasLimit, value:amountToPayForSpinUp}],
      // incorrect amount
      [{gasPrice, gasLimit, value:ethers.constants.Zero}],
    ];

    const fundedArgs = initArgs.concat(values[0]);
    const unfundedArgs = initArgs.concat(values[1]);

    const transaction = 
      await otocoMaster.createEntityWithInitializer(...fundedArgs);

    const ownerOf = (await transaction.wait()).events.pop().args.to;
    const storageCheck =  
      [
        await otocoMaster.callStatic.seriesCount(), 
        await otocoMaster.callStatic.seriesPerJurisdiction(1),
        await otocoMaster.callStatic.ownerOf(3),
      ];


    expect(transaction).to.be.ok;
    expect(storageCheck[0]).to.eq(ethers.BigNumber.from(4));
    expect(storageCheck[1]).to.eq(ethers.constants.One);
    expect(storageCheck[2]).to.eq(ownerOf);
    
    await expect(transaction).to.emit(otocoMaster, 'Transfer')
      .withArgs(zeroAddress(), owner.address, ethers.BigNumber.from(3));
    await expect(otocoMaster.createEntityWithInitializer(...unfundedArgs))
      .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

  });

  it("Should create a new entity without initializer and with plugins", async function () {
    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("600000");
    const Delaware = 
      await ethers.getContractFactory("JurisdictionDelawareV2");
    const de = Delaware.attach(await otocoMaster.jurisdictionAddress(1));
    const baseFee = await otocoMaster.baseFee();
    const amountToPayForSpinUp = 
      EthDividend.div((await priceFeed.latestRoundData()).answer)
      .mul(await de.getJurisdictionDeployPrice())
      .add(baseFee.mul(gasLimit));

    const TokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await TokenFactory.deploy();
    // const TokenPluginFactory = await ethers.getContractFactory("Token");
    // tokenPlugin = await TokenPluginFactory.deploy(
    //   otocoMaster.address,
    //   token.address,
    //   [1],
    //   [token.address],
    // );

    // const pluginData = ethers.utils.defaultAbiCoder.encode(
    //   ['uint256', 'string', 'string', 'address'],
    //   [
    //     ethers.utils.parseEther('100'), 
    //     'Test Token', 
    //     'TEST', 
    //     owner.address,
    //   ],
    // );

    const pluginABI = 
    (await hre.artifacts.readArtifact("IOtoCoPlugin")).abi;

    const mockData = 
      ethers.utils.defaultAbiCoder.encode(['string'],['mckd'],);
    
    const mockPlugin = await deployMockContract(owner, pluginABI);
    await mockPlugin.deployed();
    await mockPlugin.mock.addPlugin.withArgs(4,mockData).returns();

    const initArgs =
    [ 
      1,
      [zeroAddress(), mockPlugin.address],
      [ethers.constants.HashZero, mockData],
      0,
      "New Entity 4",
    ];

  const values = [
    // correct amount
    [{gasPrice, gasLimit, value:amountToPayForSpinUp}],
    // incorrect amount
    [{gasPrice, gasLimit, value:ethers.constants.Zero}],
  ];

  const fundedArgs = initArgs.concat(values[0]);
  const unfundedArgs = initArgs.concat(values[1]);
  const balReset = 
    (ethers.utils.parseEther('10000.0'))
      .toHexString().replace(/0x0+/, "0x");

  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [owner.address, balReset],
  });

  const transaction = 
    await otocoMaster.createEntityWithInitializer(...fundedArgs);

  const storageCheck =  
    [
      await otocoMaster.callStatic.seriesCount(), 
      await otocoMaster.callStatic.seriesPerJurisdiction(1),
      await otocoMaster.callStatic.ownerOf(4),
    ];


    expect(transaction).to.be.ok;
    expect(storageCheck[0]).to.eq(ethers.BigNumber.from(5));
    expect(storageCheck[1]).to.eq(ethers.constants.Two);
    expect(storageCheck[2]).to.eq(owner.address);
    
    await expect(transaction).to.emit(otocoMaster, 'Transfer')
      .withArgs(zeroAddress(), owner.address, ethers.BigNumber.from(4));
    await expect(otocoMaster.createEntityWithInitializer(...unfundedArgs))
      .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

  });

});