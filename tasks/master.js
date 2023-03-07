const { task } =  require("hardhat/config");

const defaultUrl = "https://otoco.io/dashpanel/entity/";  

task("master", "Deploys a OtoCo V2 Master proxy")

.addParam(
  "jurisdictions", "The V2 jurisdiction addresses")

// leave empty for default value
.addOptionalParam(
  "url", 
  "The entities page base external url", 
  defaultUrl
)

.setAction(async (taskArgs, hre) => {

  let priceFeedAddr;
  otocoMaster = await upgrades.deployProxy(
    (await ethers.getContractFactory("OtoCoMasterV2")),
    [JSON.parse(taskArgs.jurisdictions), taskArgs.url],
  );

  await otocoMaster.deployTransaction.wait(1);
  await otocoMaster.deployed();

  // Attach Chainlink Price Feed contract instance
  const priceFeedAddrs = {
    mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    polygon: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    goerli: "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
    "polygon-mumbai": "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada"
  };
  
  priceFeedAddr = 
    priceFeedAddrs[hre.network.name] || 
    (await (await ethers.getContractFactory("MockAggregatorV3")).deploy()).address;
  
  const priceFeedUpdate = await otocoMaster.changePriceFeed(priceFeedAddr);
  receipt = await priceFeedUpdate.wait();

  return [otocoMaster, priceFeedAddr];

});