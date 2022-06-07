const { getCurves } = require('crypto');
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

    // Import migration data for Launchpool
    try {
        const data = fs.readFileSync(`./migrations_data/launchpool.${network.name}.json`, {encoding: "utf-8"});
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = []
        console.log(err);
    }

    const series = toMigrate.map((e) => { return e.seriesId})
    const deployed = toMigrate.map((e) => { return e.address})

    if ( !previousJson.launchpoolSource ) {

        const LaunchPoolArtifact = await getExternalArtifact("LaunchPool");
        const LaunchPoolFactory = await ethers.getContractFactoryFromArtifact(LaunchPoolArtifact);
        deploysJson.launchpoolSource = (await LaunchPoolFactory.deploy()).address;
    }

    if ( !previousJson.launchpoolCurve ) {

        const LaunchCurveArtifact = await getExternalArtifact("LaunchCurveExponential");
        const LaunchCurveFactory = await ethers.getContractFactoryFromArtifact(LaunchCurveArtifact);
        deploysJson.launchpoolCurve = (await LaunchCurveFactory.deploy()).address;

    }

    const LaunchpoolPluginFactory = await ethers.getContractFactory("Launchpool");
    const launchpoolPlugin = await LaunchpoolPluginFactory.deploy(
        deploysJson.master,
        previousJson.launchpoolSource ? previousJson.launchpoolSource : deploysJson.launchpoolSource,
        previousJson.launchpoolCurve ? previousJson.launchpoolCurve : deploysJson.launchpoolCurve,
        series,
        deployed,
        {gasLimit: 6000000}
    );

    console.log("🚀  Launchpool plugin Deployed:", launchpoolPlugin.address);
    deploysJson.launchpool = launchpoolPlugin.address

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});