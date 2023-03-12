const fs = require('fs');
const { network } = require("hardhat");
const hre = require("hardhat");
require('dotenv').config();

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";

const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";


async function main() {

    /*****************
     * GENERAL SETUP *
     *****************/

	const networkId = network.config.chainId;
	const [deployer] = await ethers.getSigners();

  let deploysJson;

	// Load deployed master contract
	try {
		const data = fs.readFileSync(`./deploys/v2/${network.name}.json`, {encoding:"utf-8"});
		deploysJson = JSON.parse(data);
	} catch (err) {
		console.log(`${FgRed}Error loading Master address: ${err}${Reset}`);
		process.exit(1);
	}


    /******************
     * USER PROMPTING *
     ******************/

	console.log(
		`\n${Bright}\t👤 Deploying contracts with ${FgCyan}${deployer.address}${Reset}`);

	const deployerBalance = 
		parseInt((await deployer.getBalance()).toString()) / 1e18;

	console.log(
		`\t${Bright}💰 Balance: ${FgCyan}${deployerBalance.toFixed(4)} ETH${Reset}\n`);

	const explorer = networkId == '1' ? 'Etherscan' : networkId == '137' ? 'Polygonscan' : null;

	if (explorer != null) {
			console.log(`${Bright} ${explorer} Gas Tracker Data: ${Reset}`);
			await hre.run("gas", { [network.name]: true });
	}


    /****************
     * ONCHAIN TASK *
     ****************/

    // Set required additional settings
    const {priceFeed, baseFee, jurisdictions} = await hre.run("postsetup", {
        master: deploysJson.master,
        jurisdictions: JSON.stringify(deploysJson.jurisdictions),
        baseFee: process.env.BASE_FEE
      });

    /******************
     * STORAGE CHECKS *
     ******************/

    const MasterFactoryV2 = await ethers.getContractFactory("OtoCoMasterV2");
    const master = MasterFactoryV2.attach(deploysJson.master)

    // Check base Fee
    const baseFeeReturned = await master.callStatic.baseFee();
    if(baseFeeReturned.toString() === process.env.BASE_FEE) {
        console.log(`${Bright}🚀 Base Fee has been updated correctly!${Reset}`)
    } else {
        console.log(`${Bright} Base Fee differs from the expected!${Reset}
        ${FgCyan}Expected: ${FgGreen}${process.env.BASE_FEE}
        ${FgCyan}  Actual: ${FgRed}${baseFeeReturned}`
        );
    }
    // Check Jurisdictions
    for (const [idx, j] of deploysJson.jurisdictions.entries()) {
        const address = await master.callStatic.jurisdictionAddress(idx);
        if(address === j) {
            console.log(`${Bright}🚀 Jurisdiction ${idx} has been updated correctly!${Reset}
            Deployed Address: ${FgMagenta}${address}${Reset}`);
        } else {
            console.log(`${Bright}URI Source address differs from the expected!${Reset}
            ${FgCyan}Expected: ${FgGreen}${j}
            ${FgCyan}Actual: ${FgRed}${address}`
            );
        }
    }

}

main()
.then(() => process.exit(0))
.catch((error) => {
	console.error(error);
	process.exit(1);
});