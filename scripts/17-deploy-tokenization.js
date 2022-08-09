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

    // Set master contract based on file loaded
     const OtoCoMaster = await ethers.getContractFactory("OtoCoMaster");
     const otocoMaster = OtoCoMaster.attach(deploysJson.master);

    const OtoCoTokenMintable = await ethers.getContractFactory("OtoCoTokenMintable");
    const otocoTokenMintable = await OtoCoTokenMintable.deploy();
    await otocoTokenMintable.deployed()

    const OtoCoTokenNonTransferable = await ethers.getContractFactory("OtoCoTokenNonTransferable");
    const otocoTokenNonTransferable = await OtoCoTokenNonTransferable.deploy();
    await otocoTokenNonTransferable.deployed()

    const OtoCoGovernor = await ethers.getContractFactory("OtoCoGovernor");
    const otocoGovernor = await OtoCoGovernor.deploy();
    await otocoGovernor.deployed();

    const Tokenization = await ethers.getContractFactory("Tokenization");
    const tokenization = await Tokenization.deploy(
        otocoMaster.address,
        otocoGovernor.address
    );
    await tokenization.deployed()

    console.log("🚀 Token Mintable plugin Deployed:", otocoTokenMintable.address);
    console.log("🚀 Token NonTransferable plugin Deployed:", otocoTokenNonTransferable.address);
    console.log("🚀 Tokenization plugin Deployed:", tokenization.address);
    deploysJson.tokenMintable = otocoTokenMintable.address
    deploysJson.tokenNonTransferable = otocoTokenNonTransferable.address
    deploysJson.tokenization = tokenization.address

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});