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

    // Deploy Timestamp contract 
    const TimestampPluginFactory = await ethers.getContractFactory("Timestamp");
    const timestampPlugin = await TimestampPluginFactory.deploy(otocoMaster.address);

    //Store plugin address to deploys file
    console.log("🚀 Timestamp plugin Deployed:", timestampPlugin.address);
    object.timestamp = timestampPlugin.address;

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(object, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});