const { task } = require("hardhat/config");

task("initializers", "Deploys the initializers for Gnovernors and Multisigs")
  .setAction(async (taskArgs) => {

    const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
      await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
      : await ethers.getSigner()

    governorInitializer = await (await ethers.getContractFactory("GovernorInitializer", deployer)).deploy();
    governorInstance = await governorInitializer.deployed();

    return governorInstance;
  });

