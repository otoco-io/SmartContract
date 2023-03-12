const { task } =  require("hardhat/config");

const defaultUrl = "https://otoco.io/dashpanel/entity/";  

task("master", "Deploys a OtoCo V2 Master proxy")
// In case of non-fork the deploy will require jurisdictions
.addOptionalParam("jurisdictions", "The V2 jurisdiction addresses")
// leave empty for default value
.addOptionalParam("url", "The entities page base external url", defaultUrl)

.setAction(async (taskArgs, hre) => {

  const isForkedLocalNode = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true"

  // IN case of FORKED LOCAL NODE will grab deploys from forked network
  // Otherwise will grab addresses directly from connected network
  const deploysSource = isForkedLocalNode ? process.env.FORKED_NETWORK : hre.network.name;
  const deploys = require(`../deploys/v1/${deploysSource}.json`)

  // In case of FORKED LOCAL NODE will impersonate OtoCo deployer
  const deployer = isForkedLocalNode ?
      await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
      : await ethers.getSigner()
  
  const MasterFactoryV1 = await ethers.getContractFactory("OtoCoMaster", deployer);
  const MasterFactoryV2 = await ethers.getContractFactory("OtoCoMasterV2", deployer);
  // In case of running locally and forked will force implementation locally
  if (isForkedLocalNode){
    await upgrades.forceImport(deploys.master, MasterFactoryV1)
    otocoMaster = await upgrades.upgradeProxy(
      deploys.master,
      MasterFactoryV2
    );
  // In case of running a migration on testnets/mainnets
  } else if (hre.network.config.chainId != 31337){
    otocoMaster = await upgrades.upgradeProxy(
      deploys.master,
      MasterFactoryV2
    );
  // In case of running locally but not forked
  } else {
    if (!taskArgs.jurisdictions) throw Error("No Jurisdiction defined for master deployment")
    otocoMaster = await upgrades.deployProxy(
      (await ethers.getContractFactory("OtoCoMasterV2",deployer)),
      [JSON.parse(taskArgs.jurisdictions), taskArgs.url],
    );
  }

  return await otocoMaster.deployed()

});