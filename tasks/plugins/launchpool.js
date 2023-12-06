const { task } = require("hardhat/config");
const { Artifacts } = require("hardhat/internal/artifacts");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

task("launchpool", "Deploy launchpool plugin")
    .addOptionalParam("deployed", "Current deployed contract", '{}')
    .setAction(async (taskArgs) => {

        // IN case of FORKED LOCAL NODE will grab deploys from forked network
        // Otherwise will grab addresses directly from connected network
        const deploysJson = JSON.parse(taskArgs.deployed)

        const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
            await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
            : await ethers.getSigner()

        const LaunchPoolArtifact = await getExternalArtifact("LaunchPool", deployer);
        const launchpoolSource = await (await ethers.getContractFactoryFromArtifact(LaunchPoolArtifact)).deploy();
        await launchpoolSource.deployed()

        const LaunchCurveArtifact = await getExternalArtifact("LaunchCurveExponential", deployer);
        const launchpoolCurve = await (await ethers.getContractFactoryFromArtifact(LaunchCurveArtifact)).deploy();
        await launchpoolCurve.deployed()

        const LaunchpoolPluginFactory = await ethers.getContractFactory("Launchpool", deployer);
        const launchpool = await LaunchpoolPluginFactory.deploy(
            deploysJson.master,
            launchpoolSource.address,
            launchpoolCurve.address,
            [],
            []
        );
        await launchpool.deployed()


        return { launchpool, launchpoolSource, launchpoolCurve };
    });

