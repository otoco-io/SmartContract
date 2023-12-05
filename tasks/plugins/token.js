const { task } = require("hardhat/config");

task("token", "Deploy Token plugin")
    .addOptionalParam("deployed", "Current deployed contracts", '{}')
    .setAction(async (taskArgs) => {

        // IN case of FORKED LOCAL NODE will grab deploys from forked network
        // Otherwise will grab addresses directly from connected network
        const deploysJson = JSON.parse(taskArgs.deployed)

        const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
            await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
            : await ethers.getSigner()

        if (deploysJson.token) {
            console.log(err);

            const OtoCoTokenFactory = await ethers.getContractFactory("OtoCoToken", deployer);
            const token = await OtoCoTokenFactory.deploy();
            await token.deployed()

            const tokenPlugin = await ethers.getContractFactory("Token", deployer)
                .deploy(deploysJson.master, token.address, [], []);
            await tokenPlugin.deployed()

            fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
            return { verifier };
        }

        return { token, tokenPlugin }

    });

