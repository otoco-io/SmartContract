const fs = require('fs');
const { network } = require("hardhat");
const hre = require("hardhat");

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

	// Load deployed master contract
	try {
		const data = fs.readFileSync(`./deploys/v2/${network.name}.json`, {encoding:"utf-8"});
		deploysJson = JSON.parse(data);
	} catch (err) {
		console.log(`${FgRed}Error loading Master address: ${err}${Reset}`);
		process.exit(1);
	}

  [entityURI, otocoMaster] = 
    await hre.run("uri", { master: deploysJson.master });

  const returnedAddress = await otocoMaster.callStatic.entitiesURI(); 

  const [deployer] = await ethers.getSigners();
  console.log(`${Bright}👤 Contract deployed with ${deployer.address}${Reset}`, "\n");

  if(returnedAddress === entityURI.address) {
    console.log(`${Bright}🚀 URI Source has been updated correctly!${Reset}
      Deployed Address: ${FgMagenta}${entityURI.address}${Reset}`);
  } else {
    console.log(`${Bright}URI Source address differs from the expected!${Reset}
      ${FgCyan}Expected: ${FgGreen}${entityURI.address}
      ${FgCyan}Actual: ${FgRed}${returnedAddress}`
    );
  }

	deploysJson.uri = entityURI.address;

	fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));

	if (network.config.chainId != '31337') {
		let count = 0;
		let maxTries = 8;

		while (true) {
			await delay(10000);
			try {
				console.log('Verifying contract at', entityURI.address);
				
				await hre.run('verify:verify', {
						address: deploysJson.uri,
						constructorArguments: [deploysJson.master]
				});
				break;
			} catch (error) {
				if (String(error).includes('Already Verified')) {
					
					console.log(
						`Already verified contract at address` + 
						`${deploysJson.uri}`);
					break; 
				} if (++count == maxTries) {
					
					console.log(
						`Failed to verify contract at address` + 
						`${entityURI.address}, error: ${error}`);
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