const hre = require('hardhat');
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const utils = require('./utils')


describe("OtoCo Master Test", function () {
  let owner, wallet2, wallet3, wallet4;
  let OtoCoMasterV2;
  let otocoMaster;
  let jurisdictions;
  let priceFeed;

  const zeroAddress = ethers.constants.AddressZero;
  const defaultGasPrice = "2000000000";

  it("Create Jurisdictions", async function () {

    [owner, wallet2, wallet3, wallet4] = await ethers.getSigners();

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    
    const unincorporated = await Unincorporated.deploy(0, 2, 0, 'DAO', 'defaultBadgeURL', 'goldBadgeURL');
    const delaware = await Delaware.deploy(5, 5, 0, 'DELAWARE', 'defaultBadgeURLDE', 'goldBadgeURLDE');
    const wyoming = await Wyoming.deploy(50, 40, 10, 'WYOMING', 'defaultBadgeURLWY', 'goldBadgeURLWY');
    
    jurisdictions = [unincorporated.address, delaware.address, wyoming.address];
  });

  it("Initialize Master and add jurisdictions", async function () {

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
    await expect(otocoMaster.connect(wallet4).changePriceFeed(zeroAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
  })

  it("Creating series with correct fees and wrong fees", async function () {

    const [amount, gasPrice, gasLimit, baseFee] = 
    await utils.getAmountToPay(
      2, 
      otocoMaster,
      defaultGasPrice,
      "200000",
      priceFeed,
    );
    const amountToPayForSpinUp = amount.sub(baseFee.mul(gasLimit));
    
    // Remove 1% from the correct amount needed
    const notEnoughToPayForSpinUp = 
    amountToPayForSpinUp
    .sub(amountToPayForSpinUp
      .mul(ethers.constants.One)
      .div(ethers.BigNumber.from(100)));

    // Try to create without the proper amount of ETH Value, expect to fail
    await expect(otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:notEnoughToPayForSpinUp}))
    .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

    const previousBalance = await ethers.provider.getBalance(otocoMaster.address);

    // Expected to successfully create a new entity
    const transaction = await otocoMaster.createSeries(2, owner.address, "New Entity", {gasPrice, gasLimit, value:amountToPayForSpinUp});
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, owner.address, 0);
    expect((await otocoMaster.series(0)).jurisdiction).to.be.equal(2)
    expect((await otocoMaster.series(0)).name).to.be.equal("New Entity - Series 1")
    
    // Check if the amount to pay was transferred
    expect(await ethers.provider.getBalance(otocoMaster.address)).to.be.equal(previousBalance.add(amountToPayForSpinUp));

  });

  it("Should create a new entity using Multisig initializer without plugins", async function () {
    const [amountToPayForSpinUp, gasPrice, gasLimit] = 
      await utils.getAmountToPay(
        2, 
        otocoMaster,
        defaultGasPrice,
        "450000",
        priceFeed,
      );

    const GnosisSafeArtifact = 
      await utils.getExternalArtifact("GnosisSafe");
    const GnosisSafeFactory = 
      await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
    gnosisSafe = await GnosisSafeFactory.deploy();

    const GnosisSafeProxyFactoryArtifact = 
      await utils.getExternalArtifact("GnosisSafeProxyFactory");
    const GnosisSafeProxyFactoryFactory = 
      await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
    gnosisSafeProxyFactory = await GnosisSafeProxyFactoryFactory.deploy();

    gnosisSafeInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);
    const data = gnosisSafeInterface.encodeFunctionData('setup', [
        [owner.address, wallet2.address],
        1,
        zeroAddress,
        [],
        zeroAddress,
        zeroAddress,
        0,
        zeroAddress
    ]);

    const gnosisSafeFactoryInterface = 
      new ethers.utils.Interface(GnosisSafeProxyFactoryArtifact.abi);
    const dataFactory = 
      gnosisSafeFactoryInterface.encodeFunctionData('createProxy', [
        gnosisSafe.address,
        data
      ],
    );

    const initArgs = [ 
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
    await expect(transaction).to.emit(otocoMaster, 'Transfer').withArgs(zeroAddress, proxyAddress, 1);

    const tokenId = "1";
    const BadgeVerifier = await ethers.getContractFactory("BadgeVerifier");
    const badgeVerifier = await BadgeVerifier.deploy(otocoMaster.address);
    const dataStruct = [
      { tokenId, account: wallet4.address },
      { tokenId, account: owner.address },
      { tokenId, account: wallet2.address }
    ];
    const [badges, badgeStates] = await Promise.all([
      Promise.all(dataStruct.map(d => badgeVerifier.callStatic.getBadges(d))),
      Promise.all(dataStruct.map(d => badgeVerifier.callStatic.getBadgeState(d)))
    ]);
    const expectedBadges = [[0],[2],[2]];
    const expectedBadgeStates = [false,true,true];

    expect(badges).to.deep.eq(expectedBadges);
    expect(badgeStates).to.deep.eq(expectedBadgeStates);
    
    const proxyInstance = await GnosisSafeFactory.attach(proxyAddress);
    expect(await proxyInstance.getOwners()).to.be.eql([owner.address, wallet2.address]);

    await expect(otocoMaster.createEntityWithInitializer(...unfundedArgs))
      .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");
    
    await expect(otocoMaster.createEntityWithInitializer(...initError))
      .to.be.revertedWithCustomError(otocoMaster, "InitializerError");
    await expect(otocoMaster.createEntityWithInitializer(...initError2))
      .to.be.revertedWithCustomError(otocoMaster, "InitializerError");

  });

  it("Should create a new entity using Multisig initializer with plugins", async function () {
      const [amountToPayForSpinUp, gasPrice, gasLimit] = 
      await utils.getAmountToPay(
        0, 
        otocoMaster,
        defaultGasPrice,
        "680000",
        priceFeed,
      );

    const GnosisSafeArtifact = 
      await utils.getExternalArtifact("GnosisSafe");
    const GnosisSafeFactory = 
      await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
    gnosisSafe = await GnosisSafeFactory.deploy();

    const GnosisSafeProxyFactoryArtifact = 
      await utils.getExternalArtifact("GnosisSafeProxyFactory");
    const GnosisSafeProxyFactoryFactory = 
      await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
    gnosisSafeProxyFactory = await GnosisSafeProxyFactoryFactory.deploy();
    gnosisSafeInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);
    const signers = await ethers.getSigners();

    const getSignerAddrs = ( amount, addrs ) => {
      return addrs.slice(0, amount).map(({ address }) => address);
    };

    // Build Encoded Setup Function Data with owners array
      const data = (_owners) => { 
        return gnosisSafeInterface.encodeFunctionData(
        'setup', [
          // address[] calldata _owners,
          _owners,
          // uint256 _threshold,
          1,
          // address to,
          zeroAddress,
          // bytes calldata data,
          [],
          // address fallbackHandler,
          zeroAddress,
          // address paymentToken,
          zeroAddress,
          // uint256 payment,
          0,
          // address payable paymentReceiver
          zeroAddress,
        ]);
      };

    const gnosisSafeFactoryInterface = 
      new ethers.utils.Interface(GnosisSafeProxyFactoryArtifact.abi);
      
    // 405957 gas for 8 owners
    const dataFactory = 
      gnosisSafeFactoryInterface.encodeFunctionData(
        'createProxy', 
        [ 
          gnosisSafe.address, 
          data(getSignerAddrs(8, signers)), // [owner, wallet2, wallet3, ...] 
        ],
    );


    const TimestampPlugin = 
      await ethers.getContractFactory("TimestampV2");
    const timestampPlugin = 
      await TimestampPlugin.deploy(otocoMaster.address);
    const pluginData = 
      ethers.utils.defaultAbiCoder.encode(
        ['string', 'string'], 
        ['filename', 'cid'],
      );

      // ethers estimation fail returns fixed 30_000_000 cost
      // console.log(await otocoMaster.estimateGas.createEntityWithInitializer(
      //     0,
      //     [gnosisSafeProxyFactory.address, timestampPlugin.address],
      //     [dataFactory, pluginData],
      //     0,
      //     "New Entity 2",
      //     {gasPrice, gasLimit, value:amountToPayForSpinUp},
      //   ),
      // );

    const transaction = await otocoMaster.createEntityWithInitializer(
      0,
      [gnosisSafeProxyFactory.address, timestampPlugin.address],
      [dataFactory, pluginData],
      0,
      "New Entity 2",
      {gasPrice, gasLimit, value:amountToPayForSpinUp},
    );

    const bn = await transaction.blockNumber;
    const timestampCheck = (await ethers.provider.getBlock(bn)).timestamp;

    const proxyAddress = 
      ((await transaction.wait())
      .events.filter(event => event.event === 'Transfer')
      .map(event => (event.args.to)).toString()
    );

    const storageCheck =  [
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
      await expect(transaction).to.emit(timestampPlugin, 'DocumentTimestamped')
      .withArgs(2, timestampCheck, 'filename', 'cid');
    await expect(transaction).to.emit(otocoMaster, 'Transfer')
      .withArgs(zeroAddress, proxyAddress, ethers.constants.Two);

  });

  it("Should create a new entity without initializer and without plugins", async function () {
    const [amountToPayForSpinUp, gasPrice, gasLimit] = 
    await utils.getAmountToPay(
      1, 
      otocoMaster,
      defaultGasPrice,
      "180000",
      priceFeed,
    );

    const initArgs =
      [ 
        1,
        [zeroAddress],
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
    const storageCheck =  [
      await otocoMaster.callStatic.seriesCount(), 
      await otocoMaster.callStatic.seriesPerJurisdiction(1),
      await otocoMaster.callStatic.ownerOf(3),
    ];

    const tokenId = "3";
    const BadgeVerifier = await ethers.getContractFactory("BadgeVerifier");
    const badgeVerifier = await BadgeVerifier.deploy(otocoMaster.address);
    const dataStruct = [
      { tokenId, account: wallet4.address },
      { tokenId, account: owner.address },
      { tokenId, account: wallet2.address }
    ];
    const [badges, badgeStates] = await Promise.all([
      Promise.all(dataStruct.map(d => badgeVerifier.callStatic.getBadges(d))),
      Promise.all(dataStruct.map(d => badgeVerifier.callStatic.getBadgeState(d)))
    ]);
    const expectedBadges = [[0],[1],[0]];
    const expectedBadgeStates = [false,true,false];

    
    expect(transaction).to.be.ok;
    expect(storageCheck[0]).to.eq(ethers.BigNumber.from(4));
    expect(storageCheck[1]).to.eq(ethers.constants.One);
    expect(storageCheck[2]).to.eq(ownerOf);
    
    expect(badges).to.deep.eq(expectedBadges);
    expect(badgeStates).to.deep.eq(expectedBadgeStates);

    await expect(transaction).to.emit(otocoMaster, 'Transfer')
      .withArgs(zeroAddress, owner.address, ethers.BigNumber.from(3));
    await expect(otocoMaster.createEntityWithInitializer(...unfundedArgs))
      .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");

  });

  it("Should create a new entity without initializer and with plugins", async function () {
    const [amountToPayForSpinUp, gasPrice, gasLimit] = 
    await utils.getAmountToPay(
      1, 
      otocoMaster,
      defaultGasPrice,
      "450000",
      priceFeed,
    );

    const TokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await TokenFactory.deploy();
    const TokenPluginFactory = await ethers.getContractFactory("TokenV2");
    const tokenPlugin = await TokenPluginFactory.deploy(
      otocoMaster.address,
      token.address,
      [1],
      [token.address],
    );

    const pluginData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'string', 'string', 'address'],
      [
        ethers.utils.parseEther('100'), 
        'Test Token', 
        'TEST', 
        owner.address,
      ],
    );

    const initArgs =
    [ 
      1,
      [zeroAddress, tokenPlugin.address],
      [ethers.constants.HashZero, pluginData],
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
    (ethers.utils.parseEther('10000000.0'))
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

  const tokenProxyCheck = await tokenPlugin.callStatic.tokensDeployed(4,0);


    expect(transaction).to.be.ok;
    expect(storageCheck[0]).to.eq(ethers.BigNumber.from(5));
    expect(storageCheck[1]).to.eq(ethers.constants.Two);
    expect(storageCheck[2]).to.eq(owner.address);
    
    await expect(transaction).to.emit(otocoMaster, 'Transfer')
      .withArgs(zeroAddress, owner.address, ethers.BigNumber.from(4));
    await expect(transaction).to.emit(tokenPlugin, 'TokenAdded')
      .withArgs(ethers.BigNumber.from(4), tokenProxyCheck);
    await expect(otocoMaster.createEntityWithInitializer(...unfundedArgs))
      .to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");
  });
  
  it("Should create a new DAO using Governor initializer without plugins", async function () 
  {
    const [amountToPayForSpinUp, gasPrice, gasLimit] = 
    await utils.getAmountToPay(
      2, 
      otocoMaster,
      defaultGasPrice,
      "1200000",
      priceFeed,
    );

    const Token = await ethers.getContractFactory("OtoCoTokenMintable");
    const tokenRef = await Token.deploy();
    const Governor = await ethers.getContractFactory("OtoCoGovernor");
    const governorRef = await Governor.deploy();

    const tokenInfo = ['Test Token', 'TEST'];
    const addresses  = [
      // Manager
      owner.address,
      // Token Source 
      tokenRef.address, 
      // Member addresses
      owner.address,
      wallet2.address, 
    ];
    const settings = [
      2,  // Member size 
      10, // Voting period
      50, // `owner` shares 
      50, // `wallet2` shares
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
      [{gasPrice, gasLimit, value:ethers.constants.Zero}],
    ];

    const fundedArgs = initArgs.concat(values[0]);
    const unfundedArgs = initArgs.concat(values[1]);

    const transaction =
      await otocoMaster
      .createEntityWithInitializer(...fundedArgs);
    const [newTokenAddr, newGovernorAddr] = 
      (await transaction.wait())
      .events.filter(event => event.event === 'Initialized')
      .map(event => (event.address),
    );

    // const [transfer1, transfer2] = 
    //   (await transaction.wait())
    //   .events.filter(event => event.event === 'OwnershipTransferred');

    const newToken = Token.attach(newTokenAddr);
    const newGovernor = Governor.attach(newGovernorAddr);

    const currBal = await ethers.provider.getBalance(governorProxyFactory.address);
    const tokenInfoCheck = [
      (await newToken.callStatic.name()), 
      (await newToken.callStatic.symbol()),
    ];
    const memberSharesCheck = [
      (await newToken.callStatic.balanceOf(owner.address)),
      (await newToken.callStatic.balanceOf(wallet2.address)),
    ];
    const newTokenOwner = await newToken.callStatic.owner();
    const governorInfoCheck = [
      (await newGovernor.callStatic.token()),
      (await newGovernor.callStatic.getManager()),
      (await newGovernor.callStatic.isAllowedContracts([addresses[0]])),
      (await newGovernor.callStatic.votingPeriod()),
      (await newGovernor.callStatic.name()),
    ];
    const expectedGovernorArgs = [
      // Token
      newToken.address,
      // Manager
      addresses[0],
      // Allowed
      true, 
      // Voting Period
      10, 
      // Token/Governor name
      tokenInfo[0],
    ];

    const tokenId = "5";
    const BadgeVerifier = await ethers.getContractFactory("BadgeVerifier");
    const badgeVerifier = await BadgeVerifier.deploy(otocoMaster.address);
    const data = [
      { tokenId, account: wallet4.address },
      { tokenId, account: owner.address },
      { tokenId, account: wallet2.address }
    ];
    const [badges, badgeStates] = await Promise.all([
      Promise.all(data.map(d => badgeVerifier.callStatic.getBadges(d))),
      Promise.all(data.map(d => badgeVerifier.callStatic.getBadgeState(d)))
    ]);
    const expectedBadges = [[0],[3,4],[3]];
    const expectedBadgeStates = [false,true,true];


    expect(transaction).to.be.ok;

    expect(currBal).to.eq(10);

    expect(transaction).to.emit(
      newToken, 
      "OwnershipTransferred",
    ).withArgs(
      ethers.constants.AddressZero, 
      governorProxyFactory.address,
    );
    expect(transaction).to.emit(
      newToken, 
      "OwnershipTransferred",
    ).withArgs(
      governorProxyFactory.address,
      newGovernor.address, 
    );

    expect(...tokenInfoCheck)
      .to.eq(...tokenInfo);
    expect(...memberSharesCheck)
      .to.eq(...settings.slice(2, 4),
    );
    expect(newTokenOwner)
      .to.eq(newGovernorAddr).and
      .to.eq(newGovernor.address,
    );
    expect(...governorInfoCheck).to.eq(...expectedGovernorArgs);

    expect(badges).to.deep.eq(expectedBadges);
    expect(badgeStates).to.deep.eq(expectedBadgeStates);

    await expect(
      otocoMaster.createEntityWithInitializer(...unfundedArgs),
    ).to.be.revertedWithCustomError(otocoMaster, "InsufficientValue");
    await expect(
      otocoMaster.createEntityWithInitializer(...fundedArgs),
    ).to.be.revertedWithCustomError(otocoMaster, "InitializerError");

  });
  it("Should estimate gas for createEntityWithInitializer with Multisig initializer", async function () {
    const [amountToPayForSpinUp, gasPrice, gasLimit] = 
    await utils.getAmountToPay(
      0, 
      otocoMaster,
      defaultGasPrice,
      "450000",
      priceFeed,
    );

    const GnosisSafeArtifact = 
      await utils.getExternalArtifact("GnosisSafe");
    const GnosisSafeFactory = 
      await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
    gnosisSafe = await GnosisSafeFactory.deploy();

    const GnosisSafeProxyFactoryArtifact = 
    await utils.getExternalArtifact("GnosisSafeProxyFactory");
    const GnosisSafeProxyFactoryFactory = 
    await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
    gnosisSafeProxyFactory = await GnosisSafeProxyFactoryFactory.deploy();
    gnosisSafeInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);
    const signers = await ethers.getSigners();

    const getSignerAddrs = ( amount, addrs ) => {
      return addrs.slice(0, amount).map(({ address }) => address);
    };

    // Build Encoded Setup Function Data with owners array
      const data = (_owners) => { 
        return gnosisSafeInterface.encodeFunctionData(
        'setup', [
          // address[] calldata _owners,
          _owners,
          // uint256 _threshold,
          1,
          // address to,
          zeroAddress,
          // bytes calldata data,
          [],
          // address fallbackHandler,
          zeroAddress,
          // address paymentToken,
          zeroAddress,
          // uint256 payment,
          0,
          // address payable paymentReceiver
          zeroAddress,
        ]);
      };

      const numberOfOwners = 2;   // Min. value as safety measure := 2
      const numberOfPlugins = 1;  // Min. value as safety measure := 1

      // console.log(`\nEstimation for 
        // Number of Owners: ${numberOfOwners}; 
        // Number of Plugins: ${numberOfPlugins}.\n`);

      const gnosisCost = 
      Number((await gnosisSafeProxyFactory.estimateGas.createProxy(
        gnosisSafe.address, 
        data(getSignerAddrs( numberOfOwners, signers )),
      )).toString());

      // console.log(`Owners: `)
      // console.table(
        // getSignerAddrs( numberOfOwners, signers )
      // );
      // console.log(
      //   `Gas cost for ${numberOfOwners} owner addresses: `,
      //   gnosisCost, `gas units.`
      // );

      const TimestampPlugin = 
      await ethers.getContractFactory("TimestampV2");
    const timestampPlugin = 
      await TimestampPlugin.deploy(otocoMaster.address);
    const pluginData = 
      ethers.utils.defaultAbiCoder.encode(
        ['string', 'string'], 
        ['filename', 'cid'],
      );

    await otocoMaster.createEntityWithInitializer(
      0,
      [zeroAddress, timestampPlugin.address],
      [ethers.constants.HashZero, pluginData],
      0,
      "New Entity 6",
      {gasPrice, gasLimit, value:amountToPayForSpinUp},
    );

    await otocoMaster.changeBaseFees(0);
    const pluginCost = 
      Number((await timestampPlugin
      .estimateGas.addPlugin(6, pluginData)).toString());

      const baseCost = (gnosisCost + (pluginCost * numberOfPlugins));

      // console.log(`Gas cost increase per addPlugin call:`, pluginCost, `gas units`);

      // console.log(`\nSafe Hardcoded gasLimit Suggestion: > `, baseCost + (baseCost / 2) );
  });
  it("Should estimate gas for createEntityWithInitializer with Governor initializer", async function () {
    const governorRef = 
      await (await ethers.getContractFactory("OtoCoGovernor")).deploy();
    const tokenRef = await (await ethers.getContractFactory("OtoCoTokenMintable")).deploy();
    
      const addresses  = [
        // Manager
        otocoMaster.address,
        // Token Source 
        tokenRef.address, 
        // Member addresses
        owner.address,
        wallet2.address, 
      ];
      const settings = [
        2,  // Member size 
        10, // Voting period
        50, // `owner` shares 
        50, // `wallet2` shares
      ];
      const pluginData = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'address[]', 'address[]', 'uint256[]'],
        [
          'Test Token', 'TEST',
          [addresses[0]],
          addresses,
          settings
        ],
      );
    const governorProxyFactory  = 
      await hre.run("initializers");
    const intializeCost = Number((await governorProxyFactory.estimateGas.setup(
      governorRef.address, pluginData
    )).toString());

    // console.log(`\nSafe Hardcoded gasLimit Suggestion: > `, intializeCost + (intializeCost / 2) );
  });

});