const { expect } = require("chai");
const { ethers, network, upgrades } = require("hardhat");
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

describe("OtoCo Token Without Fees Plugin Test", function () {

  let owner, wallet2, wallet3, wallet4, externalWallet;
  let OtoCoMaster;
  let otocoMaster;
  let jurisdictions;
  let tokenMintableSource;
  let tokenNonTransferableSource;
  let governorSource;
  let governorPlugin;

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4, externalWallet] = await ethers.getSigners();

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

  it("Deploy source contracts and plugin", async function () {
    const [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const tokenMintableFactory = await ethers.getContractFactory("OtoCoTokenMintable");
    tokenMintableSource = await tokenMintableFactory.deploy();
    expect(await tokenMintableSource.name()).to.be.equal("");
    expect(await tokenMintableSource.symbol()).to.be.equal("");

    await expect(tokenMintableSource.initialize('test', 'TST'))
    .to.be.revertedWith('Initializable: contract is already initialized');

    const tokenNonTransferableFactory = await ethers.getContractFactory("OtoCoTokenNonTransferable");
    tokenNonTransferableSource = await tokenNonTransferableFactory.deploy();
    expect(await tokenNonTransferableSource.name()).to.be.equal("");
    expect(await tokenNonTransferableSource.symbol()).to.be.equal("");

    await expect(tokenNonTransferableSource.initialize('test', 'TST'))
    .to.be.revertedWith('Initializable: contract is already initialized');

    const OtoCoGovernorFactory = await ethers.getContractFactory("OtoCoGovernor");
    governorSource = await OtoCoGovernorFactory.deploy();
    expect(await governorSource.name()).to.be.equal("");
    expect(await governorSource.votingDelay()).to.be.equal(0);
    expect(await governorSource.votingPeriod()).to.be.equal(0);

    await expect(governorSource.initialize(tokenNonTransferableSource.address, owner.address, [], 1, "Test"))
    .to.be.revertedWith('Initializable: contract is already initialized');

    const TokenizationFactory = await ethers.getContractFactory("Tokenization");
    tokenizationPlugin = await TokenizationFactory.deploy(
        otocoMaster.address,
        governorSource.address
    );
  });

  it("Test Transferable Tokens and Governor", async function () {
    // DEPLOY NEW GOVERNOR USING MINTABLE SOURCE
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'address[]', 'address[]', 'uint256[]'],
        ['Tokenizer', 'TOK', [], [owner.address, tokenMintableSource.address, wallet2.address, wallet3.address, wallet4.address],
        [3,10,ethers.utils.parseEther('80'),ethers.utils.parseEther('10'),ethers.utils.parseEther('10')]]
    );
    let transaction = await tokenizationPlugin.connect(wallet2).addPlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Tokenized');
    
    const OtoCoGovernorFactory = await ethers.getContractFactory("OtoCoGovernor");
    const governor = OtoCoGovernorFactory.attach(await tokenizationPlugin.connect(wallet2).governorsDeployed(0));

    // CHECK GOVERNOR SETTINGS
    expect(await governor.name()).to.be.equal("Tokenizer");
    expect(await governor.version()).to.be.equal("1");
    expect(await governor.getManager()).to.be.equal(owner.address);
    expect(await governor.votingDelay()).to.be.equal(1);
    expect(await governor.votingPeriod()).to.be.equal(10);
    expect(await governor.quorumNumerator()).to.be.equal(50);
    expect(await governor.quorumDenominator()).to.be.equal(100);
    expect(await governor.connect(wallet2).proposalThreshold()).to.be.equal(1);
    expect(await governor.connect(owner).proposalThreshold()).to.be.equal(0);
    expect(await governor.COUNTING_MODE()).to.be.equal('support=bravo&quorum=for,abstain');

    const tokenMintableFactory = await ethers.getContractFactory("OtoCoTokenMintable");
    const token = tokenMintableFactory.attach(await governor.token());

    // CHECKING TOKEN SUPPLY AND BALANCES
    expect(await token.totalSupply()).to.be.equal(ethers.utils.parseEther('100'));
    expect(await token.decimals()).to.be.equal(18);
    expect(await token.balanceOf(wallet2.address)).to.be.equals(ethers.utils.parseEther('80'));
    expect(await token.balanceOf(wallet3.address)).to.be.equals(ethers.utils.parseEther('10'));
    expect(await token.balanceOf(wallet4.address)).to.be.equals(ethers.utils.parseEther('10'));

    // TRANSFER TOKENS FROM FIRST WALLET TO THE MANAGER
    await token.connect(wallet2).transfer(owner.address,ethers.utils.parseEther('10'))
    expect(await token.balanceOf(wallet2.address)).to.be.equals(ethers.utils.parseEther('70'));
    expect(await token.balanceOf(owner.address)).to.be.equals(ethers.utils.parseEther('10'));

    await network.provider.send("evm_mine");

    // CHECK VOTING POWER
    let currentBlock = parseInt(await network.provider.send("eth_blockNumber", []))
    expect(await governor.quorum(currentBlock-1)).to.be.equal(ethers.utils.parseEther('50'));
    expect(await governor.getVotes(owner.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('10'));
    expect(await governor.getVotes(wallet2.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('70'));
    expect(await governor.getVotes(wallet3.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('10'));
    expect(await governor.getVotes(wallet4.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('10'));
    
    //await network.provider.send("evm_increaseTime", [3600])
    await network.provider.send("evm_mine");

    currentBlock = parseInt(await network.provider.send("eth_blockNumber", []))
    expect(await governor.getVotes(owner.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('10'));

    // Transfer back tokens to wallet2
    await token.connect(owner).transfer(wallet2.address,ethers.utils.parseEther('10'))
    await network.provider.send("evm_mine");
    currentBlock = parseInt(await network.provider.send("eth_blockNumber", []))

    expect(await governor.getVotes(owner.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('0'));

    transaction = await owner.sendTransaction({to:governor.address, value: ethers.utils.parseEther('1')});
    expect(await governor.provider.getBalance(governor.address)).to.be.equal(ethers.utils.parseEther('1'));

    let txTargets = [wallet2.address];
    let txValues = [ethers.utils.parseEther('1').toString()];
    let txCalldata = ['0x'];
    let txDescription = 'This should be accepted'

    expect(governor.connect(externalWallet).propose(txTargets,txValues,txCalldata,txDescription))
    .to.be.revertedWith('GovernorCompatibilityBravo: proposer votes below proposal threshold');

    expect(await governor.getVotes(wallet2.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('80'));

    transaction = await governor.connect(wallet3).propose(txTargets,txValues,txCalldata,txDescription)
    let proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    await expect(transaction).to.emit(governor, 'ProposalCreated')

    // TEST CREATE A PROPOSAL
    expect(governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription))
    .to.be.revertedWith('Governor: proposal already exists');

    await network.provider.send("evm_mine");

    // CASTING VOTES
    expect(governor.connect(wallet2).execute(txTargets,txValues,txCalldata,ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))))
    .to.be.revertedWith('Governor: proposal not successful');

    transaction = await governor.connect(wallet4).castVote(proposalId, 1)
    await expect(transaction).to.emit(governor, 'VoteCast');

    expect(governor.connect(wallet2).execute(txTargets,txValues,txCalldata,ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))))
    .to.be.revertedWith('Governor: proposal not successful');

    transaction = await governor.connect(wallet3).castVote(proposalId, 0)
    await expect(transaction).to.emit(governor, 'VoteCast');    

    expect(governor.connect(wallet2).execute(txTargets,txValues,txCalldata,ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))))
    .to.be.revertedWith('Governor: proposal not successful');  

    transaction = await governor.connect(wallet2).castVote(proposalId, 1)
     await expect(transaction).to.emit(governor, 'VoteCast');

    // Wait for voting ends
    let deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    // TEST EXECUTE PROPOSAL
    transaction = await governor.connect(wallet2).execute(txTargets,txValues,txCalldata,ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription)))
    await expect(transaction).to.emit(governor, 'ProposalExecuted');
    // CHECK IF THE TRANSACTION WAS CORRECTLY EXECUTED
    expect(await governor.provider.getBalance(governor.address)).to.be.equal(ethers.utils.parseEther('0'));

    // TEST A MINT PROCCESS ON THE TOKEN USING GOVERNOR
    let ABI = [
        "function mint(address to, uint amount)"
    ];
    let iToken = new ethers.utils.Interface(ABI);

    txTargets = [await governor.token()];
    txValues = [0];
    txCalldata = [iToken.encodeFunctionData("mint", [ owner.address, ethers.utils.parseEther('13') ])];
    txDescription = 'Testing token contract'

    transaction = await governor.connect(wallet3).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    await network.provider.send("evm_mine");  // mine one block to start voting

    await governor.connect(wallet2).castVote(proposalId, 1);
    await governor.connect(wallet3).castVote(proposalId, 1);
    await governor.connect(wallet4).castVote(proposalId, 1);

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    transaction = await governor.execute(txTargets,txValues,txCalldata,ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription)))
    await expect(transaction).to.emit(governor, 'ProposalExecuted');

    await network.provider.send("evm_mine");

    currentBlock = await ethers.provider.getBlockNumber();
    expect(await governor.getVotes(owner.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('13'));

  });

  it("Test Non Transferable Tokens and Governor", async function () {
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'address[]', 'address[]', 'uint256[]'],
        ['Tokenizer', 'TOK', [], [owner.address, tokenNonTransferableSource.address, wallet2.address, wallet3.address, wallet4.address], [3,6545,80,10,10]]
    );
    let transaction = await tokenizationPlugin.connect(wallet2).addPlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Tokenized');
    
    const OtoCoGovernorFactory = await ethers.getContractFactory("OtoCoGovernor");
    const governor = OtoCoGovernorFactory.attach(await tokenizationPlugin.connect(wallet2).governorsDeployed(0));

    expect(await governor.name()).to.be.equal("Tokenizer");
    expect(await governor.version()).to.be.equal("1");
    expect(await governor.getManager()).to.be.equal(owner.address);
    expect(await governor.votingDelay()).to.be.equal(1);
    expect(await governor.votingPeriod()).to.be.equal(6545);

    const tokenNonTransferableFactory = await ethers.getContractFactory("OtoCoTokenNonTransferable");
    const token = tokenNonTransferableFactory.attach(await governor.token());

    expect(await token.totalSupply()).to.be.equal('100');
    expect(await token.decimals()).to.be.equal(18);
    expect(await token.balanceOf(wallet2.address)).to.be.equals('80');
    expect(await token.balanceOf(wallet3.address)).to.be.equals('10');
    expect(await token.balanceOf(wallet4.address)).to.be.equals('10');

    await expect(token.connect(wallet2).transfer(owner.address,10))
    .to.be.revertedWith('Ownable: caller is not the owner');

    await expect(token.connect(wallet2).transfer(owner.address,10))
    .to.be.revertedWith('Ownable: caller is not the owner');

    // //  There's no Attach function at Launchpool plugin
    // await expect(tokenPlugin.connect(wallet3).addPlugin(0, encoded))
    // .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // tokenAddress = (await transaction.wait()).events[2].args.token;
    // const tokenDeployed = TokenFactory.attach(tokenAddress);
    
    // expect(await tokenDeployed.name()).to.be.equal("Test Token");
    // expect(await tokenDeployed.symbol()).to.be.equal("TTOK");
    // expect(await tokenDeployed.totalSupply()).to.be.equal(ethers.utils.parseEther('8000000'));
    // expect(await tokenPlugin.tokensPerEntity(0)).to.be.equals(1);
    // expect(await tokenPlugin.tokensDeployed(0,0)).to.be.equals(tokenAddress);
    
    // await expect(tokenDeployed.initialize('', '', "100", zeroAddress()))
    // .to.be.revertedWith('Initializable: contract is already initialized');

    // encoded = ethers.utils.defaultAbiCoder.encode(['uint256'],[0]);
    // transaction = await tokenPlugin.connect(wallet2).removePlugin(0, encoded);
    // await expect(transaction).to.emit(tokenPlugin, 'TokenRemoved').withArgs(0, tokenAddress);

    // encoded = ethers.utils.defaultAbiCoder.encode(['address'],[tokenAddress]);
    // transaction = await tokenPlugin.connect(wallet2).attachPlugin(0, encoded);
    // await expect(transaction).to.emit(tokenPlugin, 'TokenAdded');

    // // There's no Attach function at Launchpool plugin
    // await expect(tokenPlugin.connect(wallet3).attachPlugin(0, encoded))
    // .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // // There's no Attach function at Launchpool plugin
    // await expect(tokenPlugin.connect(wallet3).removePlugin(0, encoded))
    // .to.be.revertedWith('OtoCoPlugin: Not the entity owner.');

    // await expect(tokenPlugin.connect(wallet2).updateTokenContract(zeroAddress()))
    // .to.be.revertedWith('Ownable: caller is not the owner');

    //  await tokenPlugin.updateTokenContract(zeroAddress())
    //  expect(await tokenPlugin.tokenContract()).to.be.equal(zeroAddress());
  });

});