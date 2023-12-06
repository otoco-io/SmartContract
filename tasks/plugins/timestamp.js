const { task } = require("hardhat/config");

task("timestamp", "Deploy Timestamp plugin")
    .addOptionalParam("deployed", "Current deployed contract", '{}')
    .setAction(async (taskArgs) => {

        // IN case of FORKED LOCAL NODE will grab deploys from forked network
        // Otherwise will grab addresses directly from connected network
        const deploysJson = JSON.parse(taskArgs.deployed)

        const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
            await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
            : await ethers.getSigner()

        // Deploy Timestamp contract
        const timestamp = await (await ethers.getContractFactory("Timestamp", deployer)).deploy(deploysJson.master);
        await timestamp.deployed()

        return { timestamp };
    });

