const { task } = require("hardhat/config");
const { Artifacts } = require("hardhat/internal/artifacts");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

task("multisig", "Deploy multisig plugin")
    .addOptionalParam("deployed", "Current deployed contract", '{}')
    .addOptionalParam("previous", "Previous deployments and external contracts", '{}')
    .setAction(async (taskArgs) => {

        // IN case of FORKED LOCAL NODE will grab deploys from forked network
        // Otherwise will grab addresses directly from connected network
        const deploysJson = JSON.parse(taskArgs.deployed)
        const previousJson = JSON.parse(taskArgs.previous)

        const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
            await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
            : await ethers.getSigner()

        if (!previousJson.safe) {
            const GnosisSafeArtifact = await getExternalArtifact("GnosisSafe", deployer);
            const GnosisSafeFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
            deploysJson.gnosisSafe = (await GnosisSafeFactory.deploy()).address;
        }

        if (!previousJson.safeFactory) {
            const GnosisSafeProxyFactoryArtifact = await getExternalArtifact("GnosisSafeProxyFactory", deployer);
            const GnosisSafeProxyFactoryFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
            deploysJson.gnosisSafeProxyFactory = (await GnosisSafeProxyFactoryFactory.deploy()).address;
        }

        const MultisigPluginFactory = await ethers.getContractFactory("Multisig", deployer);
        const multisig = await MultisigPluginFactory.deploy(
            deploysJson.master,
            previousJson.safe ? previousJson.safe : deploysJson.gnosisSafe,
            previousJson.safeFactory ? previousJson.safeFactory : deploysJson.gnosisSafeProxyFactory,
            [],
            []
        );
        await multisig.deployed()

        return {
            multisig,
            safe: deploysJson.gnosisSafe,
            safeFactory: deploysJson.gnosisSafeProxyFactory,
        };
    });
