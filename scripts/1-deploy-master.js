const fs = require('fs');
const { network } = require("hardhat");

async function main() {

    let object;
    try {
        const data = fs.readFileSync(`./deploys/${network.name}.json`, {encoding: "utf-8"});
        object = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        object = {
            jurisdictions: [],
            master: ''
        }
    }

    const TimestampPluginFactory = await ethers.getContractFactory("Timestamp");
    const timestampPlugin = await TimestampPluginFactory.deploy(otocoMaster.address);

    OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    const master = await otocoMaster.deployed();

    console.log("🚀 OtoCo Master Deployed:", master.address);
    object.master = master.address

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(object, undefined, 2));
}
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});