const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const chai = require("chai");

const { Artifacts } = require("hardhat/internal/artifacts");
const { zeroAddress } = require("ethereumjs-util");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

describe("OtoCo Token Without Fees Plugin Test", function () {

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

    await otocoMaster.changeBaseFees(0);

    // Expected to successfully create a new entity
    await otocoMaster.connect(wallet2).createSeries(2, wallet2.address, "New Entity");
    // Expect to create another entity
    await otocoMaster.connect(wallet3).createSeries(1, wallet3.address, "Another Entity");
  });

  it("Deploy and remove Token plugin", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

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
    let transaction = await tokenPlugin.connect(wallet2).addPlugin(0, encoded);
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet3).addPlugin(0, encoded))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    //console.log((await transaction.wait()).events)
    tokenAddress = (await transaction.wait()).events[2].args.token;
    const tokenDeployed = TokenFactory.attach(tokenAddress);
    
    expect(await tokenDeployed.name()).to.be.equal("Test Token");
    expect(await tokenDeployed.symbol()).to.be.equal("TTOK");
    expect(await tokenDeployed.totalSupply()).to.be.equal(ethers.utils.parseEther('8000000'));
    expect(await tokenPlugin.tokensPerEntity(0)).to.be.equals(1);
    expect(await tokenPlugin.tokensDeployed(0,0)).to.be.equals(tokenAddress);
    
    await expect(tokenDeployed.initialize('', '', "100", zeroAddress()))
    .to.be.revertedWith('Initializable: contract is already initialized');

    encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    transaction = await tokenPlugin.connect(wallet2).removePlugin(0, encoded);
    await expect(transaction).to.emit(tokenPlugin, 'TokenRemoved').withArgs(0, tokenAddress);

    encoded = ethers.utils.defaultAbiCoder.encode(['address'],[tokenAddress]);
    transaction = await tokenPlugin.connect(wallet2).attachPlugin(0, encoded);
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet3).attachPlugin(0, encoded))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // There's no Attach function at Launchpool plugin
    await expect(tokenPlugin.connect(wallet3).removePlugin(0, encoded))
    .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    await expect(tokenPlugin.connect(wallet2).updateTokenContract(zeroAddress()))
    .to.be.revertedWith('Ownable: caller is not the owner');

     await tokenPlugin.updateTokenContract(zeroAddress())
     expect(await tokenPlugin.tokenContract()).to.be.equal(zeroAddress());
  });

});