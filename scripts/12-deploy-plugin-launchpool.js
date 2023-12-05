const fs = require('fs');
const { network } = require("hardhat");
const hre = require("hardhat");

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
        const data = fs.readFileSync(`./deploys/v2/${network.name}.json`, { encoding: "utf-8" });
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

    const { launchpool, launchpoolSource, launchpoolCurve } =
        await hre.run("launchpool", {
            deploys: JSON.stringify(deploysJson)
        });


    /******************
     * STORAGE CHECKS *
     ******************/

    console.log(`${Bright}🚀 LaunchPool Source Address:${Reset}${FgMagenta}${launchpoolSource.address}${Reset}`);
    console.log(`${Bright}🚀 LaunchPool Curve Address:${Reset}${FgMagenta}${launchpoolCurve.address}${Reset}`);
    console.log(`${Bright}🚀 LaunchPool Plugin Address:${Reset}${FgMagenta}${launchpool.address}${Reset}`);

    deploysJson.launchpool = launchpool.address;
    deploysJson.launchpoolCurve = launchpoolCurve.address;
    deploysJson.launchpoolSource = launchpoolSource.address;

    fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));

    /**********************
     * SOURCE VERIFICATON *
     **********************/

    if (network.config.chainId != '31337') {
        await hre.run("verification", {
            addr: launchpoolSource.address,
            args: JSON.stringify([]),
        });
        await hre.run("verification", {
            addr: launchpoolCurve.address,
            args: JSON.stringify([]),
        });
        await hre.run("verification", {
            addr: tokenization.address,
            args: JSON.stringify([deploysJson.master, launchpoolSource.address, launchpoolCurve.address, [], []]),
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });