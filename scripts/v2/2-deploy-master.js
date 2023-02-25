const fs = require('fs');
const { network } = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";

const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";

async function main() {

	let deploysJson;

	// Load deployed jurisdictions
	try {
		const data = fs.readFileSync(`./deploys/v2/${network.name}.json`, {encoding:"utf-8"});
		deploysJson = JSON.parse(data);
	} catch (err) {
		console.log(`${FgRed}Error loading jurisdictions: ${err}${Reset}`);
		process.exit(1);
	}

	OtoCoMasterV2 = await ethers.getContractFactory("OtoCoMasterV2");
	otocoMaster = await upgrades.deployProxy(OtoCoMasterV2, [deploysJson.jurisdictions, 'https://otoco.io/dashpanel/entity/']);
	const master = await otocoMaster.deployed();

	const [deployer] = await ethers.getSigners();
	console.log(`${Bright}👤 Contract deployed with ${deployer.address}${Reset}`, "\n");
	console.log(`${Bright}🚀 OtoCo V2 Master Deployed: ${FgMagenta}${master.address}${Reset}`);

	let jurisdictions = deploysJson.jurisdictions;

    for (const [i, address] of jurisdictions.entries()) {
        console.log(`${FgCyan}Checking jurisdiction ${i}:${Reset}`);
        const returnedAddress = await otocoMaster.callStatic.jurisdictionAddress(i);
        console.log(returnedAddress);
        if (returnedAddress === address) {
			console.log(`Address ${i}: ${FgGreen}${address} - Match!${Reset}`);
		} else {
			console.log(`Address ${i}: ${FgRed}${address} - No match!${Reset}`);
		}
    }

	deploysJson.master = master.address;

	fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
}

main()
.then(() => process.exit(0))
.catch((error) => {
	console.error(error);
	process.exit(1);
});
