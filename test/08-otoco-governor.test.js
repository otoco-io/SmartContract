const { expect } = require("chai");
const { ethers, network, upgrades } = require("hardhat");
const { zeroAddress } = require("ethereumjs-util");
const chai = require("chai");

const hre = require("hardhat");

function getInterfaceID(contractInterface) {
  let interfaceID = ethers.constants.Zero;
  const functions = Object.keys(
    contractInterface.functions,
  );
  for (let i = 0; i < functions.length; i++) {
    interfaceID = interfaceID.xor(
      contractInterface.getSighash(functions[i]),
    );
  }
  return interfaceID;
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
    
    const erc165ID = ethers.BigNumber.from(0x01ffc9a7)._hex;
    const GovernorInterface = 
      new ethers.utils.Interface(
        (await hre.artifacts.readArtifact("IGovernor")).abi);
    const governorID = (getInterfaceID(GovernorInterface).xor(erc165ID))._hex;

    expect(await governorSource.callStatic.supportsInterface(erc165ID)).to.be.true;
    expect(await governorSource.callStatic.supportsInterface(governorID)).to.be.true;

    await expect(governorSource.initialize(tokenNonTransferableSource.address, owner.address, [owner.address], 1, "Test"))
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
    //console.log(await transaction.wait())
    await expect(transaction).to.emit(tokenizationPlugin, 'Tokenized');
    
    const OtoCoGovernorFactory = await ethers.getContractFactory("OtoCoGovernor");
    const governor = OtoCoGovernorFactory.attach(await tokenizationPlugin.connect(wallet2).governorsDeployed(0));

    // CHECK GOVERNOR SETTINGS
    expect(await governor.name()).to.be.equal("Tokenizer");
    expect(await governor.version()).to.be.equal("1");
    expect(await governor.getManager()).to.be.equal(owner.address);
    expect(await governor.votingDelay()).to.be.equal(1);
    expect(await governor.votingPeriod()).to.be.equal(10);
    expect(await governor.proposalThreshold()).to.be.equal(0); // Manager always return 0 here
    expect(await governor.connect(wallet2).proposalThreshold()).to.be.equal(1); // Uses wallet 2 because owner will always retun 0
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

    expect(governor.connect(wallet4).castVote(proposalId, 1))
    .to.be.revertedWith('Governor: vote not currently active');

    // TEST CREATE A PROPOSAL
    expect(governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription))
    .to.be.revertedWith('Governor: proposal already exists');

    await network.provider.send("evm_mine");

    // CASTING VOTES
    expect(governor.connect(wallet2).execute(txTargets,txValues,txCalldata,ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))))
    .to.be.revertedWith('Governor: proposal not successful');

    expect(governor.connect(wallet2).execute(txTargets,txValues,txCalldata,ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))))
    .to.be.revertedWith('Governor: proposal not successful');

    transaction = await governor.connect(wallet3).castVoteWithReason(proposalId, 0, 'dont agree') // WIll reject with reason for code coverage purpose
    await expect(transaction).to.emit(governor, 'VoteCast').withArgs(
      wallet3.address,
      proposalId,
      0,
      ethers.utils.parseEther('10'),
      'dont agree'
    );    

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
    txTargets = [await governor.token()];
    txValues = [0];
    txCalldata = [tokenMintableFactory.interface.encodeFunctionData("mint", [ owner.address, ethers.utils.parseEther('13') ])];
    txDescription = 'Testing token contract minting'

    transaction = await governor.connect(wallet3).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    await network.provider.send("evm_mine");  // mine one block to start voting

    await governor.connect(wallet2).castVote(proposalId, 1);
    await governor.connect(wallet4).castVote(proposalId, 2);      // Will absent voting for code coverage purposes

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    let descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');

    await network.provider.send("evm_mine");

    currentBlock = await ethers.provider.getBlockNumber();
    expect(await governor.getVotes(owner.address, currentBlock-1)).to.be.equal(ethers.utils.parseEther('13'));

    txCalldata2 = [tokenMintableFactory.interface.encodeFunctionData("burnFrom", [ owner.address, ethers.utils.parseEther('3') ])];
    txDescription2 = 'Testing token contract burning';
    transaction2 = await governor.connect(wallet3).propose(txTargets,txValues,txCalldata2,txDescription2);
    burnProposalId = (await transaction2.wait()).events[0].args.proposalId.toString();
    
    await network.provider.send("evm_mine");  // mine one block to start voting

    await governor.connect(wallet2).castVote(burnProposalId, 1);

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(burnProposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine");
    };

    let descriptionHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription2));
    const burnExec = await governor.execute(txTargets,txValues,txCalldata2,descriptionHash2);
    expect(burnExec).to.be.ok;
    await expect(tokenMintableSource.burnFrom(wallet2.address, 1))
      .to.be.revertedWith("Ownable: caller is not the owner");
    await expect(tokenMintableSource.mint(wallet2.address, 1))
      .to.be.revertedWith("Ownable: caller is not the owner");

    await network.provider.send("evm_mine");

    // LAST TESTING ON GOVERNANCE PLUGIN

    // Try to create another tokenization for the entity
    expect(tokenizationPlugin.connect(wallet2).addPlugin(0, encoded))
    .to.be.revertedWith('Tokenization: Entity Tokenization already exists');

    // Untokenize entity
    transaction = await tokenizationPlugin.connect(wallet2).removePlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Untokenized');

  });

  it("Test Change Governor Settings", async function () {
    // DEPLOY NEW GOVERNOR USING MINTABLE SOURCE
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'address[]', 'address[]', 'uint256[]'],
        ['Tokenizer', 'TOK', [], [owner.address, tokenMintableSource.address, wallet2.address],
        [1,10,ethers.utils.parseEther('100')]]
    );
    let transaction = await tokenizationPlugin.connect(wallet2).addPlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Tokenized');
    
    const OtoCoGovernorFactory = await ethers.getContractFactory("OtoCoGovernor");
    const governor = OtoCoGovernorFactory.attach(await tokenizationPlugin.connect(wallet2).governorsDeployed(0));

    await tokenizationPlugin.updateGovernorContract(governor.address);
    expect(await tokenizationPlugin.callStatic.governorContract()).to.eq(governor.address);
    await expect(tokenizationPlugin.connect(wallet3).updateGovernorContract(governor.address)).to.be.revertedWith("Ownable: caller is not the owner");

    const tokenMintableFactory = await ethers.getContractFactory("OtoCoTokenMintable");
    const token = tokenMintableFactory.attach(await governor.token());

    // CHECKING TOKEN SUPPLY AND BALANCES
    expect(await token.totalSupply()).to.be.equal(ethers.utils.parseEther('100'));
    expect(await token.balanceOf(wallet2.address)).to.be.equals(ethers.utils.parseEther('100'));

    await network.provider.send("evm_mine");

    // TEST CHANGE GOVERNOR ALL SETTINGS
    let txTargets = [governor.address,governor.address,governor.address,governor.address];
    let txValues = [0,0,0,0];
    let txCalldata = [
      OtoCoGovernorFactory.interface.encodeFunctionData("setVotingPeriod", [ 5 ]),
      OtoCoGovernorFactory.interface.encodeFunctionData("setProposalThreshold", [ 15 ]),
      OtoCoGovernorFactory.interface.encodeFunctionData("setVotingDelay", [ 3 ]),
      OtoCoGovernorFactory.interface.encodeFunctionData("updateQuorumNumerator", [ 30 ])
    ];
    let txDescription = 'Change Voting Settings'

    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    await network.provider.send("evm_mine");  // mine one block to start voting
    await governor.connect(wallet2).castVote(proposalId, 1);

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');

    expect(await governor.votingDelay()).to.be.equals(3);
    expect(await governor.votingPeriod()).to.be.equals(5);
    expect(await governor.proposalThreshold()).to.be.equals(0);     // As owner is the manager always return 0
    expect(await governor.connect(wallet3).proposalThreshold()).to.be.equals(15);
    expect(await governor.quorumNumerator()).to.be.equals(30);


    // TEST CHANGE OTOCO GOVERNOR SETTINGS

    txTargets = [governor.address,governor.address];
    txValues = [0,0];
    txCalldata = [
      // Set wallet 3 as Manager
      OtoCoGovernorFactory.interface.encodeFunctionData("setManager", [ wallet3.address ]),
      // Allow interact with wallet 3 address
      OtoCoGovernorFactory.interface.encodeFunctionData("setAllowContract", [ wallet3.address, true ]),
    ];
    txCalldata2 = [
      // Revert case
      OtoCoGovernorFactory.interface.encodeFunctionData("setAllowContract", [ governor.address, true ]),
    ];

    await expect(governor.setManager(owner.address))
      .to.be.revertedWith("Governor: onlyGovernance");
    await expect(governor.setAllowContract(wallet3.address, true))
      .to.be.revertedWith("Governor: onlyGovernance");

    txDescription = 'Change OtoCo Governor Settings'

    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription);
    await expect(governor.connect(wallet2).propose(txTargets,txValues,txCalldata2,txDescription))
      .to.be.reverted;
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString();
    
    await network.provider.send("evm_mine");  // mine three block to start voting
    await network.provider.send("evm_mine");
    await network.provider.send("evm_mine");
    await governor.connect(wallet2).castVote(proposalId, 1);

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');

    // TEST CHANGE OTOCO GOVERNOR SETTINGS

    // Send some money to Governor
    transaction = await owner.sendTransaction({to:governor.address, value: ethers.utils.parseEther('1')});
    expect(await governor.provider.getBalance(governor.address)).to.be.equal(ethers.utils.parseEther('1'));

    txTargets = [wallet3.address];
    txValues = [ethers.utils.parseEther('1').toString()];
    txCalldata = ['0x'];
    txDescription = 'Send money to manager wallet'

    transaction = await governor.connect(wallet3).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    expect(await governor.isManagerProposal(proposalId)).to.be.equals(true)

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.connect(wallet3).execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');

    expect(await governor.provider.getBalance(governor.address)).to.be.equal(ethers.utils.parseEther('0'));

    // Untokenize entity
    transaction = await tokenizationPlugin.connect(wallet2).removePlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Untokenized');
    await expect(tokenizationPlugin.connect(wallet2).removePlugin(0, encoded)).to.be.revertedWith("Tokenization: Entity Tokenization not exists");


    // Retokenize entity
    let encoded2 = ethers.utils.defaultAbiCoder.encode(
      ['address[]', 'address[]', 'uint256[]'],
      [
        [], 
        [owner.address, tokenMintableSource.address, wallet2.address],
        [1,10],
      ],
    );
    // Branch 1
    await otocoMaster.changeBaseFees(1);
    const val = ethers.utils.parseEther("1");
    transaction = await tokenizationPlugin.connect(wallet2).attachPlugin(
      0, 
      encoded2, 
      { value: val },
    );
    await expect(transaction).to.emit(tokenizationPlugin, 'Tokenized');
    await expect(tokenizationPlugin.connect(wallet2).attachPlugin(0, encoded2, { value: val }))
    .to.be.rejectedWith("Tokenization: Entity Tokenization already exists");
    await tokenizationPlugin.connect(wallet2).removePlugin(0, ethers.constants.HashZero, { value: val });
    await otocoMaster.changeBaseFees(0);
    await expect(tokenizationPlugin.connect(wallet3).attachPlugin(0, encoded2))
      .to.be.revertedWith("OtoCoPlugin: Not the entity owner.");

    // Branch 2
    const tx1 = 
      await tokenizationPlugin.connect(wallet2)
        .attachPlugin(0, encoded2);
    const tx2 = 
      await tokenizationPlugin.connect(wallet2)
        .removePlugin(0, ethers.constants.HashZero);
    
    expect(tx1).to.be.ok;
    expect(tx2).to.be.ok;

    // Burn removed... only burn with proposal
    //await token.connect(wallet2).burn(ethers.utils.parseEther('10'));
    //expect(await token.connect(wallet2).balanceOf(wallet2.address)).to.be.equals(ethers.utils.parseEther('90'));

  });

  it("Test Non-Transferable Token Settings", async function () {
    // DEPLOY NEW GOVERNOR USING NON-TRASFERABLE SOURCE
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'address[]', 'address[]', 'uint256[]'],
        ['Tokenizer', 'TOK', [], [owner.address, tokenNonTransferableSource.address, wallet2.address],
        [1,10,ethers.utils.parseEther('100')]]
    );
    let transaction = await tokenizationPlugin.connect(wallet2).addPlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Tokenized');
    await expect(tokenizationPlugin.connect(wallet2).addPlugin(0, encoded))
      .to.be.rejectedWith("Tokenization: Entity Tokenization already exists"
    );
    await expect(tokenizationPlugin.connect(wallet3).addPlugin(0, encoded))
      .to.be.rejectedWith("OtoCoPlugin: Not the entity owner."
    );
    
    const TokenNonTransferableFactory = await ethers.getContractFactory("OtoCoTokenNonTransferable");
    const OtoCoGovernorFactory = await ethers.getContractFactory("OtoCoGovernor");

    const governor = OtoCoGovernorFactory.attach(await tokenizationPlugin.governorsDeployed(0));
    const token = tokenNonTransferableSource.attach(await governor.token());

    // -------------------- CHECKING TOKEN SUPPLY AND BALANCES ---------------------------
    expect(await token.totalSupply()).to.be.equal(ethers.utils.parseEther('100'));
    expect(await token.balanceOf(wallet2.address)).to.be.equals(ethers.utils.parseEther('100'));

    await network.provider.send("evm_mine");

    // ------------------- TEST CHANGE OTOCO GOVERNOR SETTINGS ---------------------------
    txTargets = [token.address];
    txValues = [0];
    txCalldata = [ TokenNonTransferableFactory.interface.encodeFunctionData("mint", [ wallet3.address, 100 ]) ];
    txDescription = 'Change OtoCo Governor Settings'

    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    await network.provider.send("evm_mine");  // mine three block to start voting
    await governor.connect(wallet2).castVote(proposalId, 1);

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');

    // Try transfer and it should prevent it
    await expect(token.connect(wallet3).transfer(wallet2.address, 100))
    .to.be.revertedWith('Ownable: caller is not the owner');
    await expect(token.connect(wallet3).transferFrom(wallet3.address, wallet2.address, 100))
    .to.be.revertedWith('Ownable: caller is not the owner');

    // ------------------- TEST CHANGE OTOCO GOVERNOR SETTINGS ---------------------------
    txTargets = [token.address];
    txValues = [0];
    txCalldata = [ TokenNonTransferableFactory.interface.encodeFunctionData("transferFrom", [ wallet3.address, wallet2.address, 100 ]) ];
    txDescription = 'Change OtoCo Governor Settings'

    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    await network.provider.send("evm_mine");  // mine three block to start voting
    await governor.connect(wallet2).castVote(proposalId, 1);

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');

    // ------------------- TEST BURN TOKENS ---------------------------
    txTargets = [token.address];
    txValues = [0];
    txCalldata = [ TokenNonTransferableFactory.interface.encodeFunctionData("burnFrom", [ wallet2.address, 100 ]) ];
    txDescription = 'Burn Tokens'
    
    const transferOwnership = [
      [token.address],// txTargets
      [0],// txValues
      [TokenNonTransferableFactory// txCalldata
      .interface.encodeFunctionData("transferOwnership", [ owner.address ])],
      'Ownership Transfer'// txDescription
    ];

    const transferTx = await governor.connect(wallet2).propose(...transferOwnership);
    await network.provider.send("evm_mine");  // mine three block to start voting
    
    proposalId2 = (await transferTx.wait()).events[0].args.proposalId.toString();
    await governor.connect(wallet2).castVote(proposalId2, 1);
    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId2)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine");
    };

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(transferOwnership[3]));
    transaction = await governor.execute(
      transferOwnership[0],
      transferOwnership[1],
      transferOwnership[2],
      descriptionHash
    );

    const burnTx = await token.burnFrom(wallet2.address, 100);
    expect(burnTx).to.be.ok;
    await token.transferOwnership(governor.address);

    
    await expect(token.burnFrom(wallet2.address, 100)).to.be.revertedWith("Ownable: caller is not the owner");
    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    await network.provider.send("evm_mine");  // mine three block to start voting
    const proposalState = await governor.callStatic.state(proposalId);
    await governor.connect(wallet2).castVote(proposalId, 1);
    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }
    
    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');
    
    expect(await token.totalSupply()).to.be.equal(ethers.utils.parseEther('100').sub(ethers.BigNumber.from(100)));
    expect(await token.balanceOf(wallet2.address)).to.be.equals(ethers.utils.parseEther('100').sub(ethers.BigNumber.from(100)));
    expect(transaction).to.emit(token, "Transfer");
    expect(proposalState).to.eq(ethers.constants.Zero);

    // ------------------- TEST CANCEL PROPOSAL ---------------------------
    txTargets = [token.address];
    txValues = [0];
    txCalldata = [ TokenNonTransferableFactory.interface.encodeFunctionData("transferFrom", [ wallet2.address, wallet3.address, 100 ]) ];
    txDescription = 'Change OtoCo Governor Settings'

    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    
    await network.provider.send("evm_mine");  // mine three block to start voting
    await governor.connect(wallet2).castVote(proposalId, 1);

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.cancel(txTargets,txValues,txCalldata,descriptionHash)
    expect(await governor.state(proposalId)).to.eq(ethers.constants.Two)
    await expect(transaction).to.emit(governor, 'ProposalCanceled');

    // ----------------------------- UNTOKENIZE ENTITY --------------------------------------
    transaction = await tokenizationPlugin.connect(wallet2).removePlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Untokenized');
    await expect(tokenizationPlugin.connect(wallet3).removePlugin(0, encoded))
      .to.be.revertedWith("OtoCoPlugin: Not the entity owner.");
  });

  it("Test Cast Vote with Signature and Resign", async function () {
    // DEPLOY NEW GOVERNOR USING NON-TRASFERABLE SOURCE
    let encoded = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'address[]', 'address[]', 'uint256[]'],
        ['Tokenizer', 'TOK', [], [owner.address, tokenNonTransferableSource.address, wallet2.address],
        [1,10,ethers.utils.parseEther('100')]]
    );
    let transaction = await tokenizationPlugin.connect(wallet2).addPlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Tokenized');
    
    const TokenNonTransferableFactory = await ethers.getContractFactory("OtoCoTokenNonTransferable");
    const OtoCoGovernorFactory = await ethers.getContractFactory("OtoCoGovernor");

    const governor = OtoCoGovernorFactory.attach(await tokenizationPlugin.governorsDeployed(0));
    const token = tokenNonTransferableSource.attach(await governor.token());

    // ------------------------- CHECK RESIGN FEATURE -------------------------------- 

    expect(governor.connect(wallet2).resignAsManager())
      .to.be.revertedWith('OtocoGovernor: Only manager itself could resign');
    await (await governor.resignAsManager()).wait();
    expect(await governor.getManager()).to.be.equals(zeroAddress());

    // -------------------- CHECKING TOKEN SUPPLY AND BALANCES ---------------------------
    expect(await token.totalSupply()).to.be.equal(ethers.utils.parseEther('100'));
    expect(await token.balanceOf(wallet2.address)).to.be.equals(ethers.utils.parseEther('100'));

    await network.provider.send("evm_mine");

    // ------------------- TEST CHANGE OTOCO GOVERNOR SETTINGS ---------------------------
    txTargets = [token.address];
    txValues = [0];
    txCalldata = [ TokenNonTransferableFactory.interface.encodeFunctionData("mint", [ wallet3.address, 100 ]) ];
    txDescription = 'Change OtoCo Governor Settings'

    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    expect(await governor.isManagerProposal(proposalId)).to.be.equals(false)

    await network.provider.send("evm_mine");  // mine three block to start voting
    
    let types = {
        Ballot: [
          { name: "proposalId", type: "uint256" },
          { name: "support", type: "uint8" },
        ],
    }
    let domain = {
        name: await governor.name(),
        version: await governor.version(),
        chainId: network.config.chainId,
        verifyingContract: governor.address
    }
    let value = {
      proposalId: proposalId,
      support: 1
    }

    let result = await wallet2._signTypedData(domain, types, value);
    let signature = result.substring(2);
    let r = "0x" + signature.substring(0, 64);
    let s = "0x" + signature.substring(64, 128);
    let v = parseInt(signature.substring(128, 130), 16);
    // The signature is now comprised of r, s, and v.
    transaction = await governor.connect(wallet4).castVoteBySig(proposalId, 1, v, r, s);
    await expect(transaction).to.emit(governor, 'VoteCast').withArgs(
      wallet2.address,
      proposalId,
      1,
      ethers.utils.parseEther('100'),
      ''
    );    
    await expect(governor.connect(wallet4).castVoteBySig(proposalId, 9, v, r, s))
      .to.be.revertedWith("GovernorVotingSimple: invalid value for enum VoteType");

    // Wait for voting ends
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }

    expect(await governor.hasVoted(proposalId, wallet2.address)).to.be.equals(true);

    descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription))
    transaction = await governor.execute(txTargets,txValues,txCalldata,descriptionHash)
    await expect(transaction).to.emit(governor, 'ProposalExecuted');
    expect(await governor.callStatic.state(proposalId)).to.eq(ethers.BigNumber.from(7));
    
    await expect(governor.callStatic.state(ethers.constants.Zero))
      .to.be.revertedWith("Governor: unknown proposal id");
    // await expect(governor.connect(wallet4).castVoteBySig(proposalId, 1, v, r, s))
    //   .to.be.revertedWith("GovernorVotingSimple: vote already cast");

    // Defeat proposal
    txCalldata = [ TokenNonTransferableFactory.interface.encodeFunctionData("mint", [ wallet4.address, 10 ]) ];
    transaction = await governor.connect(wallet2).propose(txTargets,txValues,txCalldata,txDescription)
    proposalId = (await transaction.wait()).events[0].args.proposalId.toString()
    await network.provider.send("evm_mine");  // mine three block to start voting
    
    types = {
        Ballot: [
          { name: "proposalId", type: "uint256" },
          { name: "support", type: "uint8" },
        ],
    }
    domain = {
        name: await governor.name(),
        version: await governor.version(),
        chainId: 1,
        verifyingContract: governor.address
    }
    value = {
      proposalId: proposalId,
      support: 0
    }

    result = await wallet2._signTypedData(domain, types, value);
    signature = result.substring(2);
    r = "0x" + signature.substring(0, 64);
    s = "0x" + signature.substring(64, 128);
    v = parseInt(signature.substring(128, 130), 16);
    transaction = await governor.connect(wallet4).castVoteBySig(proposalId, 0, v, r, s);
    await expect(governor.connect(wallet4).castVoteBySig(proposalId, 0, v, r, s))
      .to.be.rejectedWith("GovernorVotingSimple: vote already cast");


    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber()
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine")
    }
    expect(await governor.callStatic.state(proposalId)).to.eq(ethers.BigNumber.from(3));

    // ----------------------------- UNTOKENIZE ENTITY --------------------------------------
    transaction = await tokenizationPlugin.connect(wallet2).removePlugin(0, encoded);
    await expect(transaction).to.emit(tokenizationPlugin, 'Untokenized');

    await expect(await governor.isAllowedContracts([zeroAddress()])).to.be.false;
  });

});