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

.setAction(async (taskArgs) => {

  otocoMaster = await upgrades.deployProxy(
    (await ethers.getContractFactory("OtoCoMasterV2")),
    [JSON.parse(taskArgs.jurisdictions), taskArgs.url],
  );

  await otocoMaster.deployTransaction.wait(1);
  const master = await otocoMaster.deployed();

  return master;

});