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

    // Import migration data for Launchpool
    try {
        const data = fs.readFileSync(`./migrations_data/launchpool.${network.name}.json`, {encoding: "utf-8"});
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = []
        console.log(err);
    }

    const series = toMigrate.map((e) => { return e.seriesIds})
    const deployed = toMigrate.map((e) => { return e.address})

    if ( network.name != 'main' ) {

        const LaunchPoolArtifact = await getExternalArtifact("LaunchPool");
        const LaunchPoolFactory = await ethers.getContractFactoryFromArtifact(LaunchPoolArtifact);
        deploysJson.launchpoolSource = (await LaunchPoolFactory.deploy()).address;

        const LaunchCurveArtifact = await getExternalArtifact("LaunchCurveExponential");
        const LaunchCurveFactory = await ethers.getContractFactoryFromArtifact(LaunchCurveArtifact);
        deploysJson.launchpoolCurve = (await LaunchCurveFactory.deploy()).address;

    }

    const LaunchpoolPluginFactory = await ethers.getContractFactory("Launchpool");
    const launchpoolPlugin = await LaunchpoolPluginFactory.deploy(
        deploysJson.master,
        deploysJson.launchpoolSource,
        deploysJson.launchpoolCurve,
        series,
        deployed
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