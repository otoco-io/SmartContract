const fs = require('fs');
const { network } = require("hardhat");

async function main() {

    let deploysJson;
    // Load deploy files created on 1-deploy-master.js
    try {
        const data = fs.readFileSync(`./deploys/v1/${network.name}.json`, {encoding:"utf-8"});
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Error loading Master address: ', err);
        process.exit(1);
    }

    OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
    otocoMaster = await upgrades.deployProxy(OtoCoMaster, [deploysJson.jurisdictions, 'https://otoco.io/dashpanel/entity/']);
    const master = await otocoMaster.deployed();

    console.log("🚀 OtoCo Master Deployed:", master.address);
    deploysJson.master = master.address

    fs.writeFileSync(`./deploys/v1/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});