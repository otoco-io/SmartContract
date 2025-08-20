const fs = require('fs');
const { ethers } = require("hardhat");
const hre = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";
const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";
const FgYellow = "\x1b[33m";

// Network configurations
const NETWORKS = {
    mainnet: { chainId: 1, file: 'main.json', version: 'v1' },
    polygon: { chainId: 137, file: 'polygon.json', version: 'v1' },
    sepolia: { chainId: 11155111, file: 'sepolia.json', version: 'v2' },
    base: { chainId: 8453, file: 'base.json', version: 'v2' },
    basesepolia: { chainId: 84532, file: 'basesepolia.json', version: 'v2' }
};

async function getDeploymentData(networkName) {
    const networkConfig = NETWORKS[networkName];
    if (!networkConfig) {
        console.log(`${FgRed}Network ${networkName} not supported${Reset}`);
        return null;
    }

    try {
        const deployPath = `./deploys/${networkConfig.version}/${networkConfig.file}`;
        const data = fs.readFileSync(deployPath, { encoding: "utf-8" });
        const deploysJson = JSON.parse(data);

        if (!deploysJson.multisig) {
            console.log(`${FgRed}No multisig address found for ${networkName}${Reset}`);
            return null;
        }

        return deploysJson;
    } catch (err) {
        console.log(`${FgRed}Error loading deployment file for ${networkName}: ${err.message}${Reset}`);
        return null;
    }
}

async function getMultisigEventsData(networkName) {
    try {
        const eventsFileName = `multisig-events-${networkName}.json`;
        const data = fs.readFileSync(`./migrations_data/${eventsFileName}`, { encoding: "utf-8" });
        const multisigEventsData = JSON.parse(data);

        console.log(`${FgGreen}✅ Loaded ${multisigEventsData.totalEvents} multisig events from ${eventsFileName}${Reset}`);
        return multisigEventsData;
    } catch (err) {
        console.log(`${FgYellow}⚠️  Warning: Could not load multisig events file for ${networkName}: ${err.message}${Reset}`);
        return { events: [] };
    }
}

async function getPreviousDeployments(networkName) {
    try {
        const data = fs.readFileSync(`./deploys/v2/previous.${networkName}.json`, { encoding: "utf-8" });
        return JSON.parse(data);
    } catch (err) {
        console.log(`${FgYellow}⚠️  Warning: Could not load previous deployments for ${networkName}: ${err.message}${Reset}`);
        return {};
    }
}

async function getConstructorArguments(deploysJson, multisigEventsData, previousJson) {
    // Extract seriesIds and multisig addresses from events
    const seriesIds = multisigEventsData.events.map(event => event.series);
    const multisigAddresses = multisigEventsData.events.map(event => event.multisig);

    console.log(`${FgCyan}📊 Processing ${seriesIds.length} multisig events for constructor args${Reset}`);

    // Constructor parameters for MultisigV2:
    // constructor(
    //     address payable otocoMaster,
    //     address masterCopy,
    //     address proxyFactory,
    //     uint256[] memory prevIds,
    //     address[] memory prevMultisig
    // )

    const constructorArgs = [
        deploysJson.master,                              // otocoMaster
        previousJson.safe || "0x0000000000000000000000000000000000000000",     // masterCopy (Gnosis Safe)
        previousJson.safeFactory || "0x0000000000000000000000000000000000000000", // proxyFactory (Gnosis Safe Proxy Factory)
        seriesIds,                                       // prevIds
        multisigAddresses                               // prevMultisig
    ];

    console.log(`${FgCyan}Constructor arguments:${Reset}`);
    console.log(`  Master: ${constructorArgs[0]}`);
    console.log(`  Safe Master Copy: ${constructorArgs[1]}`);
    console.log(`  Safe Proxy Factory: ${constructorArgs[2]}`);
    console.log(`  Series IDs count: ${constructorArgs[3].length}`);
    console.log(`  Multisig addresses count: ${constructorArgs[4].length}`);

    return constructorArgs;
}

async function verifyMultisigContract(networkName, multisigAddress, constructorArgs) {
    console.log(`${FgCyan}🔍 Verifying MultisigV2 contract on ${networkName}...${Reset}`);
    console.log(`${FgCyan}   Contract Address: ${multisigAddress}${Reset}`);

    try {
        const res = await hre.run("verify:verify", {
            address: multisigAddress,
            constructorArguments: constructorArgs,
            contract: "contracts/pluginsV2/MultisigV2.sol:MultisigV2"
        });

        console.log(res)

        console.log(`${FgGreen}✅ Successfully verified MultisigV2 on ${networkName}${Reset}`);
        return true;
    } catch (error) {
        if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
            console.log(`${FgGreen}✅ MultisigV2 on ${networkName} is already verified${Reset}`);
            return true;
        } else {
            console.log(`${FgRed}❌ Failed to verify MultisigV2 on ${networkName}: ${error.message}${Reset}`);
            return false;
        }
    }
}

async function verifyNetworkMultisig(networkName) {
    console.log(`\n${FgMagenta}🌐 Processing ${networkName.toUpperCase()}...${Reset}`);

    try {
        // Get deployment data
        const deploysJson = await getDeploymentData(networkName);
        if (!deploysJson) {
            console.log(`${FgRed}Skipping ${networkName} - no deployment data found${Reset}`);
            return { success: false, networkName, error: 'No deployment data found' };
        }

        const multisigAddress = deploysJson.multisig;

        // Get multisig events data
        const multisigEventsData = await getMultisigEventsData(networkName);

        // Get previous deployments (external contracts like Gnosis Safe)
        const previousJson = await getPreviousDeployments(networkName);

        // Get constructor arguments
        const constructorArgs = await getConstructorArguments(deploysJson, multisigEventsData, previousJson);

        // Verify the contract
        const success = await verifyMultisigContract(networkName, multisigAddress, constructorArgs);

        return { success, networkName, multisigAddress };

    } catch (error) {
        console.log(`${FgRed}❌ Failed to process ${networkName}: ${error.message}${Reset}`);
        return { success: false, networkName, error: error.message };
    }
}

async function main() {
    console.log(`${Bright}🔧 MultisigV2 Contract Verification Script${Reset}`);

    // Get the current network from hardhat runtime environment
    const networkName = hre.network.name;

    if (!NETWORKS[networkName]) {
        console.log(`${FgRed}Network ${networkName} not supported. Available networks: ${Object.keys(NETWORKS).join(', ')}${Reset}`);
        process.exit(1);
    }

    console.log(`${FgCyan}🌐 Verifying MultisigV2 contract on ${networkName}${Reset}`);

    try {
        const result = await verifyNetworkMultisig(networkName);

        if (result.success) {
            console.log(`\n${FgGreen}🎉 Verification completed successfully!${Reset}`);
            console.log(`${FgGreen}Contract: ${result.multisigAddress}${Reset}`);
        } else {
            console.log(`\n${FgRed}❌ Verification failed: ${result.error}${Reset}`);
            process.exit(1);
        }

    } catch (error) {
        console.error(`${FgRed}❌ Error: ${error.message}${Reset}`);
        console.error(error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`${FgRed}Error: ${error.message}${Reset}`);
        console.error(error);
        process.exit(1);
    });
