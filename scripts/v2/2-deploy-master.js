const fs = require('fs');
const { network } = require("hardhat");
const hre = require("hardhat");
const { defaultUrl } = require("../../tasks/master");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";

const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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

	const master = await hre.run("master", {
		jurisdictions: JSON.stringify(deploysJson.jurisdictions),
	});

	const [deployer] = await ethers.getSigners();
	console.log(`${Bright}👤 Contract deployed with ${deployer.address}${Reset}`, "\n");
	console.log(`${Bright}🚀 OtoCo V2 Master Deployed: ${FgMagenta}${master.address}${Reset}`);

	let jurisdictions = deploysJson.jurisdictions;

  for (const [i, address] of jurisdictions.entries()) {
    console.log(`${FgCyan}Checking jurisdiction ${i}:${Reset}`);
    const returnedAddress = await master.callStatic.jurisdictionAddress(i);
    console.log(returnedAddress);
    if (returnedAddress === address) {
			console.log(`Address ${i}: ${FgGreen}${address} - Match!${Reset}`);
		} else {
			console.log(`Address ${i}: ${FgRed}${address} - No match!${Reset}`);
		}
  }

	deploysJson.master = master.address;

	fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));
	
	const defaultUrl = (await master.callStatic.externalUrl());
	console.log(`\n ${FgCyan} externalUrl written to storage: ${Reset}`, defaultUrl, `\n`)

	if (network.config.chainId != '31337') {
		let count = 0;
		let maxTries = 8;

		while (true) {
			await delay(10000);
			try {
				console.log('Verifying contract at', master.address);
				
				await hre.run('verify:verify', {
						address: master.address,
						// constructorArguments: [/* jurisdictions, defaultUrl */]
				});
				break;
			} catch (error) {
				if (String(error).includes('Already Verified')) {
					
					console.log(
						`Already verified contract at address` + 
						`${master.address}`);
					break; 
				} if (++count == maxTries) {
					
					console.log(
						`Failed to verify contract at address` + 
						`${master.address}, error: ${error}`);
					break;
				};
				
				console.log(`Retrying... Retry #${count}, last error: ${error}`);
			}
		}
	}
}

main()
.then(() => process.exit(0))
.catch((error) => {
	console.error(error);
	process.exit(1);
});
