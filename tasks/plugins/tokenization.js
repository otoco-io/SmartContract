const { task } = require("hardhat/config");

task("tokenization", "Deploy tokenization plugin")
    .addOptionalParam("deployed", "Current deployed contract", '{}')
    .addOptionalParam("previous", "Previous deployments and external contracts", '{}')
    .setAction(async (taskArgs) => {

        // IN case of FORKED LOCAL NODE will grab deploys from forked network
        // Otherwise will grab addresses directly from connected network
        const deploysJson = JSON.parse(taskArgs.deployed)

        const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
            await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
            : await ethers.getSigner()

        // Deploys Tokenization tokens
        const OtoCoTokenMintable = await ethers.getContractFactory("OtoCoTokenMintable", deployer);
        const otocoTokenMintable = await OtoCoTokenMintable.deploy();
        await otocoTokenMintable.deployed()

        const OtoCoTokenNonTransferable = await ethers.getContractFactory("OtoCoTokenNonTransferable", deployer);
        const otocoTokenNonTransferable = await OtoCoTokenNonTransferable.deploy();
        await otocoTokenNonTransferable.deployed()

        // Deploys Tokenization contract + Governor
        const OtoCoGovernor = await ethers.getContractFactory("OtoCoGovernor", deployer);
        const otocoGovernor = await OtoCoGovernor.deploy();
        await otocoGovernor.deployed();

        const Tokenization = await ethers.getContractFactory("Tokenization", deployer);
        const tokenization = await Tokenization.deploy(
            deploysJson.master,
            otocoGovernor.address
        );
        await tokenization.deployed()

        return { otocoTokenMintable, otocoTokenNonTransferable, otocoGovernor, tokenization };
    });

