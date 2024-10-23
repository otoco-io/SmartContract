const { task } = require("hardhat/config");

task("uri", "Deploys the default URI builder for OtoCo Entities")
  .addParam("master", "The current instance of OtoCoMasterV2")
  .addParam("networkPrefix", "Network prefix to identify entities on Otoco site")
  .setAction(async (taskArgs) => {

    const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
      await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
      : await ethers.getSigner()

    entityURI = await (await ethers.getContractFactory("OtoCoURI", deployer)).deploy(taskArgs.master, taskArgs.networkPrefix);
    await entityURI.deployTransaction.wait(1);
    const uri = await entityURI.deployed();
    const master = (await ethers.getContractFactory("OtoCoMasterV2")).attach(taskArgs.master);
    const change = await master.connect(deployer).changeURISources(uri.address);
    await change.wait(1);

    return { uri, master };
  });

