const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
const { ConsensusAlgorithm } = require("@ethereumjs/common");
chai.use(solidity);

const { Artifacts } = require("hardhat/internal/artifacts");
const { zeroAddress } = require("ethereumjs-util");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}


const EthDividend = ethers.BigNumber.from(ethers.utils.parseUnits('1', 18)).mul(ethers.utils.parseUnits('1', 9)).div(10);

describe("OtoCo Master Test", function () {

  let owner, wallet2, wallet3, wallet4;
  let OtoCoMaster;
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
    const otocoBaseFee = await otocoMaster.baseFee();
    expect(await otocoMaster.changeBaseFees("5000000000000000"))
    .to.emit(otocoMaster, "BaseFeeChanged")
    .withArgs("5000000000000000");
    expect(await otocoMaster.baseFee()).to.be.equal("5000000000000000");
    const PriceFeed = await ethers.getContractFactory("MockAggregatorV3");
    priceFeed = await PriceFeed.deploy();
    expect(await otocoMaster.changePriceFeed(priceFeed.address)).to.emit(otocoMaster, "UpdatedPriceFeed");
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
    
    // Chech if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(previousBalance.add(amountToPayForSpinUp));

  });

  it("Should create a new entity using Multisig initializer", async function () {

    const gasPrice = ethers.BigNumber.from("2000000000");
    const gasLimit = ethers.BigNumber.from("600000");
    // Check the amount of ETH has to be paid after pass the priceFeed
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const wy = Wyoming.attach(await otocoMaster.jurisdictionAddress(2));
    const baseFee = await otocoMaster.baseFee();
    const amountToPayForSpinUp = 
      EthDividend.div((await priceFeed.latestRoundData()).answer)
      .mul(await wy.getJurisdictionDeployPrice())
      .add(baseFee.mul(gasLimit))

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

    const transaction = await otocoMaster.createEntityWithInitializer(
      2,
      [gnosisSafeProxyFactory.address],
      [dataFactory],
      0,
      "New Entity",
      {gasPrice, gasLimit, value:amountToPayForSpinUp}
    );

    const proxyAddress = (await transaction.wait()).events.pop().args.to
    await expect(transaction).to.emit(gnosisSafeProxyFactory, 'ProxyCreation').withArgs(proxyAddress, gnosisSafe.address)
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress(), proxyAddress, 1)
    
    const proxyInstance = await GnosisSafeFactory.attach(proxyAddress);
    expect(await proxyInstance.getOwners()).to.be.eql([owner.address, wallet2.address])
  })


});