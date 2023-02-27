const { task } =  require("hardhat/config");

task("uri", "Deploys the default URI builder for OtoCo Entities")
.addParam("master", "The current instance of OtoCoMasterV2")
.setAction(async (taskArgs) => {

  entityURI = await (await ethers.getContractFactory("OtoCoURI")).deploy(taskArgs.master);
  await entityURI.deployTransaction.wait(1);
  const uri = await entityURI.deployed();
  const masterInstance = (await ethers.getContractFactory("OtoCoMasterV2")).attach(taskArgs.master);
  await masterInstance.changeURISources(uri.address);


  return [uri, masterInstance];
});
