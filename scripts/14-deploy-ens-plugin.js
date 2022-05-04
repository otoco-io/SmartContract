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

    // Import migration data for ENS
    try {
        const data = await fs.readFile(`./migrations_data/ens.${network.name}.json`, "binary");
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = { data: { companies: [] } }
        console.log(err);
    }

    const series = toMigrate.map((e) => { return e.seriesIds})
    const names = toMigrate.map((e) => { return e.name})

    const ENSPluginFactory = await ethers.getContractFactory("ENS");
    const ensPlugin = await ENSPluginFactory.deploy(otocoMaster.address, series, names);

    console.log("🚀  ENS plugin Deployed:", ensPlugin.address);
    object.ens = ensPlugin.address

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(object, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});