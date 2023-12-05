const { task } = require("hardhat/config");

task("verifier", "Deploys the Badge Verifier for OtoCo Entities")
  .addParam("master", "The current instance of OtoCoMasterV2")
  .setAction(async (taskArgs) => {

    const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
      await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
      : await ethers.getSigner()

    const badgeVerifier = await (await ethers.getContractFactory("BadgeVerifier", deployer)).deploy(taskArgs.master);
    await badgeVerifier.deployTransaction.wait(1);
    const verifier = await badgeVerifier.deployed();

    return { verifier };
  });

