const { task } = require("hardhat/config");
const { Artifacts } = require("hardhat/internal/artifacts");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

task("ens", "Deploy ENS plugin")
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

        if (hre.network.config.chainId == 31337) {
            const ENSRegistryArtifact = await getExternalArtifact("ENSRegistry");
            const ENSRegistryFactory = await ethers.getContractFactoryFromArtifact(ENSRegistryArtifact);
            ensRegistry = await ENSRegistryFactory.deploy();

            const FIFSRegistrarArtifact = await getExternalArtifact("FIFSRegistrar");
            const FIFSRegistrarFactory = await ethers.getContractFactoryFromArtifact(FIFSRegistrarArtifact);
            fifsRegistrar = await FIFSRegistrarFactory.deploy(ensRegistry.address, ethers.utils.namehash("eth"));

            const PublicResolverArtifact = await getExternalArtifact("PublicResolver");
            const PublicResolverFactory = await ethers.getContractFactoryFromArtifact(PublicResolverArtifact);
            publicResolver = await PublicResolverFactory.deploy(ensRegistry.address, zeroAddress(), zeroAddress(), zeroAddress());

            const resolverNode = ethers.utils.namehash("resolver");
            const resolverLabel = labelhash("resolver");
            await ensRegistry.setSubnodeOwner(ethers.utils.formatBytes32String(''), resolverLabel, owner.address);
            await ensRegistry.setResolver(resolverNode, publicResolver.address);
            await ensRegistry.setOwner(ethers.utils.formatBytes32String(''), owner.address);
            await ensRegistry.setSubnodeOwner(ethers.utils.formatBytes32String(''), labelhash('eth'), fifsRegistrar.address);

            previousJson.ensRegistry = ensRegistry.address
            previousJson.ensResolver = publicResolver.address
        } else {
            previousJson.ensRegistry = previousJson.ensregistry
            previousJson.ensResolver = previousJson.resolver
        }

        const rootNode = '0xd60cd0a683332ca8ad4a4d342320945cb769f25760b42a21f2d88d3be25cc6aa' // otoco.eth

        const ENSPluginFactory = await ethers.getContractFactory("ENS", deployer);
        const ens = await ENSPluginFactory.deploy(
            deploysJson.master, previousJson.ensRegistry, previousJson.ensResolver, rootNode, [], []
        );
        await ens.deployed()

        if (hre.network.config.chainId == 31337) {
            await fifsRegistrar.register(labelhash('otoco'), ens.address);
        }

        return {
            ens,
            verifyValues: [deploysJson.master, previousJson.ensRegistry, previousJson.ensResolver, rootNode, [], []]
        };
    });

