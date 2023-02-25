const fs = require('fs');
const { network } = require("hardhat");
const { Artifacts } = require("hardhat/internal/artifacts");
const { zeroAddress } = require("ethereumjs-util");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

const labelhash = (label) => ethers.utils.solidityKeccak256(['string'],[label])

async function main() {

    const [owner] = await ethers.getSigners();

    let deploysJson;
    try {
        const data = fs.readFileSync(`./deploys/v1/${network.name}.json`, {encoding: "utf-8"});
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        process.exit(1);
    }

    let previousJson
    // Import previous source contracts
    try {
        const data = fs.readFileSync(`./deploys/v1/previous.${network.name}.json`, {encoding: "utf-8"});
        previousJson = JSON.parse(data);
    } catch (err) {
        previousJson = []
        console.log(err);
    }

    // Set master contract based on file loaded
     const OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
     const otocoMaster = OtoCoMaster.attach(deploysJson.master);

    // Import migration data for ENS
    try {
        const data = fs.readFileSync(`./migrations_data/ens.${network.name}.json`, {encoding: "utf-8"});
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = []
        console.log(err);
    }

    const series = toMigrate.map((e) => { return e.seriesId})
    const names = toMigrate.map((e) => { return e.name})

    if (network.name == 'localhost'){
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

    const ENSPluginFactory = await ethers.getContractFactory("ENS");
    const ensPlugin = await ENSPluginFactory.deploy(
        otocoMaster.address, previousJson.ensRegistry, previousJson.ensResolver, rootNode, series, names
    );

    console.log("🚀  ENS plugin Deployed:", ensPlugin.address);
    deploysJson.ens = ensPlugin.address

    if (network.name == 'localhost'){
        await fifsRegistrar.register(labelhash('otoco'), ensPlugin.address);
    }

    fs.writeFileSync(`./deploys/v1/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});