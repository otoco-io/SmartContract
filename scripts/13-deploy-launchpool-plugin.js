const fs = require('fs');
const { network } = require("hardhat");

async function main() {

    let deploysJson;
    try {
        const data = fs.readFileSync(`./deploys/${network.name}.json`, {encoding: "utf-8"});
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        process.exit(1);
    }

    // Set master contract based on file loaded
     const OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
     const otocoMaster = OtoCoMaster.attach(deploysJson.master);

    // Import migration data for Launchpool
    try {
        const data = await fs.readFile(`./migrations_data/launchpool.${network.name}.json`, "binary");
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = { data: { companies: [] } }
        console.log(err);
    }

    const series = toMigrate.map((e) => { return e.seriesIds})
    const deployed = toMigrate.map((e) => { return e.address})

    const LaunchpoolPluginFactory = await ethers.getContractFactory("Launchpool");
    const launchpoolPlugin = await LaunchpoolPluginFactory.deploy(otocoMaster.address, series, deployed);

    console.log("🚀  Launchpool plugin Deployed:", launchpoolPlugin.address);
    object.launchpool = launchpoolPlugin.address

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(object, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});