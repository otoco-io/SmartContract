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


    let previousJson;
    // Load deployed master contract
    try {
        const data = fs.readFileSync(`./deploys/v2/previous.${network.name}.json`, { encoding: "utf-8" });
        previousJson = JSON.parse(data);
    } catch (err) {
        console.log(`${FgRed}Error loading Previous/External addresses: ${err}${Reset}`);
    }

    let multisigEventsData = { events: [] };
    // Load multisig events data
    try {
        const eventsFileName = `multisig-events-${network.name}.json`;
        const data = fs.readFileSync(`./migrations_data/${eventsFileName}`, { encoding: "utf-8" });
        multisigEventsData = JSON.parse(data);
        console.log(`${FgGreen}✅ Loaded ${multisigEventsData.totalEvents} multisig events from ${eventsFileName}${Reset}`);
    } catch (err) {
        console.log(`${FgRed}Warning: Could not load multisig events file: ${err.message}${Reset}`);
        console.log(`${FgRed}Proceeding with empty arrays for seriesIds and multisigs${Reset}`);
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

    // Extract seriesIds and multisig addresses from events
    const seriesIds = multisigEventsData.events.map(event => event.series);
    const multisigAddresses = multisigEventsData.events.map(event => event.multisig);

    console.log(`${Bright}📊 Processing ${seriesIds.length} multisig events${Reset}`);
    if (seriesIds.length > 0) {
        console.log(`${FgCyan}   First few series: ${seriesIds.slice(0, 3).join(', ')}${seriesIds.length > 3 ? '...' : ''}${Reset}`);
    }

    const { multisig, safe, safeFactory } =
        await hre.run("multisig", {
            deployed: JSON.stringify(deploysJson),
            previous: JSON.stringify(previousJson),
            seriesids: JSON.stringify(seriesIds),
            multisigs: JSON.stringify(multisigAddresses)
        });


    /******************
     * STORAGE CHECKS *
     ******************/

    console.log(`${Bright}🚀 Multisig Plugin Deployed Address:${Reset}${FgMagenta}${multisig.address}${Reset}`);

    deploysJson.multisig = multisig.address;

    fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));


    /**********************
     * SOURCE VERIFICATON *
     **********************/

    if (network.config.chainId != '31337') {
        // Extract seriesIds and multisig addresses for verification
        const seriesIds = multisigEventsData.events.map(event => event.series);
        const multisigAddresses = multisigEventsData.events.map(event => event.multisig);

        await hre.run("verification", {
            addr: deploysJson.multisig,
            args: JSON.stringify([
                deploysJson.master,
                previousJson.safe,
                previousJson.safeFactory,
                seriesIds,
                multisigAddresses
            ]),
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });