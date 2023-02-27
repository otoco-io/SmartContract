const fs = require('fs');
const { network } = require("hardhat");

async function main() {

    let deploysJson;
    try {
        const data = fs.readFileSync(`./deploys/v1/${network.name}.json`, {encoding: "utf-8"});
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        process.exit(1);
    }

    // Set master contract based on file loaded
     const OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
     const otocoMaster = OtoCoMaster.attach(deploysJson.master);

    // Import migration data for Tokens
    try {
        const data = fs.readFileSync(`./migrations_data/token.${network.name}.json`, {encoding: "utf-8"});
        toMigrate = JSON.parse(data);
    } catch (err) {
        toMigrate = []
        console.log(err);
    }

    const series = toMigrate.map((e) => { return e.seriesId})
    const deployed = toMigrate.map((e) => { return e.address})

    const OtoCoTokenFactory = await ethers.getContractFactory("OtoCoToken");
    const token = await OtoCoTokenFactory.deploy();
    await token.deployed()

    const TokenPluginFactory = await ethers.getContractFactory("Token");
    const tokenPlugin = await TokenPluginFactory.deploy(otocoMaster.address, token.address, series, deployed);
    await tokenPlugin.deployed()
    
    console.log("🚀 Token plugin Deployed:", tokenPlugin.address);
    deploysJson.token = tokenPlugin.address

    fs.writeFileSync(`./deploys/v1/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});