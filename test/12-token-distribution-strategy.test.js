const hre = require('hardhat');
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const utils = require('./utils')

describe("Test Otonomos token distribution strategy", () =>  {
  let owner, wallet2, wallet3, wallet4, wallet5, wallet6;
  let OtoCoMasterV2;
  let otocoMaster;
  let jurisdictions;
  let priceFeed;
  let omt;
  let governor;

  const defaultGasPrice = "2000000000";

  it("Setup OtoCoV2", async function () {
    [owner, wallet2, wallet3, wallet4, wallet5, wallet6] = await ethers.getSigners();

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    const Swiss = await ethers.getContractFactory("JurisdictionSwissAssociationV2");
    
    const unincorporated = await Unincorporated.deploy(100, 2, 0, 'DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy(5, 5, 10, 'DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy(50, 40, 150000, 'WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');
    const swiss = await Swiss.deploy(10, 10, 10, 'SWISS', 'defaultBadgeURLSA', 'goldBadgeURLSA');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address, swiss.address];

    OtoCoMasterV2 = await ethers.getContractFactory("OtoCoMasterV2");
    otocoMaster = await upgrades.deployProxy(OtoCoMasterV2, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    await otocoMaster.deployed();

    const PriceFeed = await ethers.getContractFactory("MockAggregatorV3");
    priceFeed = await PriceFeed.deploy();
    await otocoMaster.changePriceFeed(priceFeed.address);
  });

  it("Setup Entity", async function () {
    const [amountToPayForSpinUp, gasPrice, gasLimit] = 
    await utils.getAmountToPay(
      2, 
      otocoMaster,
      defaultGasPrice,
      "1200000",
      priceFeed,
    );
    const Token = await ethers.getContractFactory("OtoCoTokenNonTransferable");
    const tokenRef = await Token.deploy();
    const Governor = await ethers.getContractFactory("OtoCoGovernor");
    const governorRef = await Governor.deploy();

    const tokenInfo = ['Otonomos governance token', 'OMT'];
    const totalSupply = ethers.BigNumber.from(100);
    const addresses  = [
      // Manager
      owner.address,
      // Token Source 
      tokenRef.address, 
      // Member addresses
      owner.address
    ];
    const settings = [
      1,   // Member size 
      5,   // Voting period
      totalSupply, // `owner` shares 
    ];

    const pluginData = ethers.utils.defaultAbiCoder.encode(
      ['string', 'string', 'address[]', 'address[]', 'uint256[]'],
      [
        ...tokenInfo,
        [addresses[0]],
        addresses,
        settings
      ],
    );

    const governorProxyFactory  = await hre.run("initializers");
    const initializerData = governorProxyFactory.interface.encodeFunctionData('setup', [
      governorRef.address, pluginData
    ]);
    
    const initArgs =
    [ 
      0,
      [governorProxyFactory.address],
      [initializerData],
      10,
      "New Unincorporated Entity",
    ];

    const values = [
      // correct amount
      [{gasLimit: Number(gasLimit.toString()), value:amountToPayForSpinUp}],
      // incorrect amount
      // [{gasPrice, gasLimit, value:ethers.constants.Zero}],
    ];

    const fundedArgs = initArgs.concat(values[0]);
    // const unfundedArgs = initArgs.concat(values[1]);

    const transaction =
      await otocoMaster
      .createEntityWithInitializer(...fundedArgs);
    const [newTokenAddr, newGovernorAddr] = 
      (await transaction.wait())
      .events.filter(event => event.event === 'Initialized')
      .map(event => (event.address),
    );

    omt = Token.attach(newTokenAddr);
    governor = Governor.attach(newGovernorAddr);

    expect(await omt.callStatic.balanceOf(owner.address)).to.eq(totalSupply);
    expect(await omt.callStatic.totalSupply()).to.eq(totalSupply);
  });
  it("Transfer ownership & distribute tokens", async function () { 
    const shares = [ethers.BigNumber.from(40), ethers.BigNumber.from(20)];
    const txTargets = [omt.address];
    const txValues = [0];
    const txCalldata = [(await ethers.getContractFactory("OtoCoTokenNonTransferable")).interface.encodeFunctionData("transferOwnership", [ wallet2.address ])];
    const txDescription = `Transfer OMT ownership to ${wallet2.address}`;

    const proposal = await governor.propose(txTargets, txValues, txCalldata, txDescription);
    const proposalId = (await proposal.wait()).events[0].args.proposalId.toString();

    await network.provider.send("evm_mine"); 

    await governor.castVote(proposalId, 1);
    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber();
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine");
    }
    const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription));
    const transaction = await governor.execute(txTargets, txValues, txCalldata, descriptionHash);

    const transaction2 =  await omt.connect(wallet2).transferFrom(owner.address, wallet3.address, shares[1]);
    const transaction3 =  await omt.connect(wallet2).transferFrom(owner.address, wallet4.address, shares[1]);
    const transaction4 =  await omt.connect(wallet2).transferFrom(owner.address, wallet5.address, shares[1]);
    
    await expect(transaction).to.emit(governor, 'ProposalExecuted');
    expect(await omt.callStatic.owner()).to.eq(wallet2.address);
    expect(transaction).to.be.ok;
    expect(transaction2).to.be.ok;
    expect(transaction3).to.be.ok;
    expect(transaction4).to.be.ok;
    expect(await omt.callStatic.balanceOf(owner.address)).to.eq(shares[0]);
    expect(await omt.callStatic.balanceOf(wallet2.address)).to.eq(ethers.constants.Zero);
    expect(await omt.callStatic.balanceOf(wallet3.address)).to.eq(shares[1]);
    expect(await omt.callStatic.balanceOf(wallet4.address)).to.eq(shares[1]);
    expect(await omt.callStatic.balanceOf(wallet5.address)).to.eq(shares[1]);

    await omt.connect(wallet3).approve(owner.address, shares[1]);
    await expect(omt.connect(wallet3).transfer(owner.address, shares[1])).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(omt.connect(wallet4).transfer(wallet2.address, ethers.constants.Two)).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(omt.connect(owner).transferFrom(wallet3.address, owner.address, shares[1])).to.be.revertedWith("Ownable: caller is not the owner");
  });
  it("Transfer ownership back & mint new tokens via proposal", async function () { 
    const transferBack = await omt.connect(wallet2).transferOwnership(governor.address);
    const share = ethers.BigNumber.from(20);
    const txTargets = [omt.address];
    const txValues = [0];
    const txCalldata = [(await ethers.getContractFactory("OtoCoTokenNonTransferable")).interface.encodeFunctionData("mint", [ wallet6.address, share ])];
    const txDescription = `Mint 20 tokens to ${wallet6.address}`;

    const proposal = await governor.propose(txTargets, txValues, txCalldata, txDescription);
    const proposalId = (await proposal.wait()).events[0].args.proposalId.toString();

    await network.provider.send("evm_mine"); 

    await governor.castVote(proposalId, 1);
    await governor.connect(wallet3).castVote(proposalId, 1);
    await governor.connect(wallet4).castVote(proposalId, 1);
    await governor.connect(wallet5).castVote(proposalId, 1);

    deadlineBlock = (await governor.proposalDeadline(proposalId)).toNumber();
    while (deadlineBlock+1 > (await ethers.provider.getBlockNumber()) ) {
      await network.provider.send("evm_mine");
    }

    const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txDescription));
    const transaction = await governor.execute(txTargets, txValues, txCalldata, descriptionHash);
    
    expect(transferBack).to.be.ok;
    expect(await omt.callStatic.owner()).to.eq(governor.address);
    await expect(omt.connect(wallet2).transferFrom(wallet2.address, wallet6.address, ethers.constants.One)).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(transaction).to.emit(governor, 'ProposalExecuted');
    expect(await omt.callStatic.balanceOf(wallet6.address)).to.eq(share);
  });
});