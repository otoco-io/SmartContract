const { task } =  require("hardhat/config"); 

task("postsetup", "Make all post-setup changes to Master Contract")
.addParam("master", "The current instance of OtoCoMasterV2")
.addParam("jurisdictions", "The V2 jurisdiction addresses")
.addParam("baseFee", "The base fee to be set for plugins and Initializers")

.setAction(async (taskArgs, hre) => {


  const isForkedLocalNode = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true"
  const isLocalButNotForked = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "false"

  // IN case of FORKED LOCAL NODE will grab deploys from forked network
  // Otherwise will grab addresses directly from connected network
  const deploysSource = isForkedLocalNode ? process.env.FORKED_NETWORK : hre.network.name;
  const deploys = require(`../deploys/v1/${deploysSource}.json`)

  // In case of FORKED LOCAL NODE will impersonate OtoCo deployer
  const deployer = isForkedLocalNode
      ? await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
      : ethers.getSigner()

  const MasterFactoryV2 = await ethers.getContractFactory("OtoCoMasterV2");
  const otocoMaster = MasterFactoryV2.attach(taskArgs.master)

  let priceFeedAddress = deploys.priceFeed

  let transaction;
  // In case of NON FORKED LOCAL NODE, will deploy a new MockAggregator for price fetch
  if (isLocalButNotForked){
    const mockAggregatorInstance = await (await ethers.getContractFactory("MockAggregatorV3", deployer)).deploy()
    await mockAggregatorInstance.deployed()
    priceFeedAddress = mockAggregatorInstance.address;
    transaction = await otocoMaster.connect(deployer).changePriceFeed(priceFeedAddress);
    await transaction.wait();
  }
  
  transaction = await otocoMaster.connect(deployer).changePriceFeed(priceFeedAddress);
  await transaction.wait();
  transaction = await otocoMaster.connect(deployer).changeBaseFees(process.env.BASE_FEE);
  await transaction.wait();

  let updatedJurisdictions = []
  for (const [idx, j] of JSON.parse(taskArgs.jurisdictions).entries()) {
    const currentAddress = await otocoMaster.jurisdictionAddress(idx)
    if (currentAddress == j) continue
    transaction = await otocoMaster.connect(deployer).updateJurisdiction(idx, j);
    await transaction.wait();

    updatedJurisdictions.push({
      index: idx,
      address: j,
    })
  }

  return {
    priceFeed: priceFeedAddress,
    baseFee: process.env.BASE_FEE,
    jurisdictions: updatedJurisdictions
  };

});