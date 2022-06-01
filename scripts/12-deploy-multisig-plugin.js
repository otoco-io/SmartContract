const fs = require('fs');
const { network } = require("hardhat");
const { Artifacts } = require("hardhat/internal/artifacts");

async function getExternalArtifact(contract) {
    const artifactsPath = "./artifacts-external";
    const artifacts = new Artifacts(artifactsPath);
    return artifacts.readArtifact(contract);
}

async function main() {

    let deploysJson;
    try {
        const data = fs.readFileSync(`./deploys/${network.name}.json`, {encoding: "utf-8"});
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        process.exit(1);
    }

    let previousJson
    // Import previous source contracts
    try {
        const data = fs.readFileSync(`./deploys/previous.${network.name}.json`, {encoding: "utf-8"});
        previousJson = JSON.parse(data);
    } catch (err) {
        previousJson = []
        console.log(err);
    }

    // Set master contract based on file loaded
     const OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
     const otocoMaster = OtoCoMaster.attach(deploysJson.master);

    // Import migration data for Multisig
    try {
        const data = fs.readFileSync(`./migrations_data/multisig.${network.name}.json`, {encoding: "utf-8"});
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = []
        console.log(err);
    }

    const series = toMigrate.map((e) => { return e.seriesId})
    const deployed = toMigrate.map((e) => { return e.address})

    if (!previousJson.safe) {

        const GnosisSafeArtifact = await getExternalArtifact("GnosisSafe");
        const GnosisSafeFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeArtifact);
        deploysJson.gnosisSafe = (await GnosisSafeFactory.deploy()).address;

    }

    if (!previousJson.safeFactory) {
        const GnosisSafeProxyFactoryArtifact = await getExternalArtifact("GnosisSafeProxyFactory");
        const GnosisSafeProxyFactoryFactory = await ethers.getContractFactoryFromArtifact(GnosisSafeProxyFactoryArtifact);
        deploysJson.gnosisSafeProxyFactory = (await GnosisSafeProxyFactoryFactory.deploy()).address;
    }

    const MultisigPluginFactory = await ethers.getContractFactory("Multisig");
    const multisigPlugin = await MultisigPluginFactory.deploy(
        otocoMaster.address,
        deploysJson.gnosisSafe,
        deploysJson.gnosisSafeProxyFactory,
        series,
        deployed
    );

    console.log("🚀 Multisig plugin Deployed:", multisigPlugin.address);
    deploysJson.multisig = multisigPlugin.address

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});