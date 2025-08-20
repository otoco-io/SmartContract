const fs = require('fs');
const { ethers } = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";
const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";

// Network configurations
const NETWORKS = {
    mainnet: { chainId: 1, file: 'main.json', version: 'v1', blockWindow: 10000000, startBlock: 14970859 },
    polygon: { chainId: 137, file: 'polygon.json', version: 'v1', blockWindow: 1000000, startBlock: 30178738 },
    sepolia: { chainId: 11155111, file: 'sepolia.json', version: 'v2', blockWindow: 1000000, startBlock: 4835564 },
    base: { chainId: 8453, file: 'base.json', version: 'v2', blockWindow: 1000000, startBlock: 11827635 },
    basesepolia: { chainId: 84532, file: 'basesepolia.json', version: 'v2', blockWindow: 1000000, startBlock: 6431257 }
};

// MultisigV2 ABI for events
const MULTISIG_ABI = [
    "event MultisigAdded(uint256 indexed series, address multisig)",
    "event MultisigRemoved(uint256 indexed series, address multisig)"
];

async function getMultisigAddress(networkName) {
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

        return deploysJson.multisig;
    } catch (err) {
        console.log(`${FgRed}Error loading deployment file for ${networkName}: ${err.message}${Reset}`);
        return null;
    }
}

async function sweepEventsForNetwork(networkName, provider, multisigAddress) {
    console.log(`${FgCyan}Sweeping events for ${networkName} (${multisigAddress})${Reset}`);

    const contract = new ethers.Contract(multisigAddress, MULTISIG_ABI, provider);
    let events = [];
    const networkConfig = NETWORKS[networkName];
    const blockWindowSize = networkConfig.blockWindow;

    try {
        const latestBlock = await provider.getBlockNumber();
        console.log(`  Latest block: ${latestBlock}`);
        console.log(`  Block window size: ${blockWindowSize}`);

        // Use configured start block for this network
        const fromBlock = networkConfig.startBlock;

        console.log(`  Scanning from block ${fromBlock} to ${latestBlock}`);

        // Sweep in chunks to avoid RPC limits
        for (let startBlock = fromBlock; startBlock <= latestBlock; startBlock += blockWindowSize) {
            const endBlock = Math.min(startBlock + blockWindowSize - 1, latestBlock);

            console.log(`    Scanning blocks ${startBlock} to ${endBlock}...`);

            try {
                // Get MultisigAdded events
                const addedFilter = contract.filters.MultisigAdded();
                const addedEvents = await contract.queryFilter(addedFilter, startBlock, endBlock);

                // Get MultisigRemoved events
                const removedFilter = contract.filters.MultisigRemoved();
                const removedEvents = await contract.queryFilter(removedFilter, startBlock, endBlock);

                // Process added events
                for (const event of addedEvents) {
                    events.push({
                        series: event.args.series.toString(),
                        multisig: event.args.multisig
                    });
                }

                // Process removed events - create a set of removed entries for efficient filtering
                const removedEntries = new Set(
                    removedEvents.map(event => `${event.args.series.toString()}-${event.args.multisig}`)
                );

                // Filter out all removed entries in a single step
                events = events.filter(e =>
                    !e.added || !removedEntries.has(`${e.series}-${e.multisig}`)
                );

                console.log(`    Found ${addedEvents.length} MultisigAdded and ${removedEvents.length} MultisigRemoved events`);

            } catch (blockError) {
                console.log(`    ${FgRed}Error scanning blocks ${startBlock}-${endBlock}: ${blockError.message}${Reset}`);
                // Continue with next block range
            }
        }

    } catch (err) {
        console.log(`  ${FgRed}Error sweeping events for ${networkName}: ${err.message}${Reset}`);
    }

    return events;
}

function generateOutputData(events) {
    const outputData = {
        timestamp: new Date().toISOString(),
        totalEvents: events.length,
        events: events
    };

    return outputData;
}

async function main() {
    console.log(`${Bright}🔍 Sweeping MultisigAdded and MultisigRemoved events across all chains${Reset}`);

    const allEvents = [];
    const timestamp = Date.now();

    for (const [networkName] of Object.entries(NETWORKS)) {
        console.log(`\n${FgMagenta}Processing ${networkName}...${Reset}`);

        // Get multisig address for this network
        const multisigAddress = await getMultisigAddress(networkName);
        if (!multisigAddress) {
            console.log(`${FgRed}Skipping ${networkName} - no multisig address found${Reset}`);
            continue;
        }

        try {
            // Create provider - this will use the network configured in hardhat.config.js
            const provider = new ethers.providers.JsonRpcProvider(
                process.env[`RPC_${networkName.toUpperCase()}_API`]
            );

            // Test connection
            await provider.getNetwork();

            // Sweep events for this network
            const networkEvents = await sweepEventsForNetwork(networkName, provider, multisigAddress);

            console.log(`${FgGreen}✅ Completed ${networkName}: found ${networkEvents.length} events${Reset}`);

            // Export after each chain sweep
            const currentData = generateOutputData(networkEvents);
            const incrementalFile = `multisig-events-${networkName}.json`;
            fs.writeFileSync(`migrations_data/` + incrementalFile, JSON.stringify(currentData, null, 2));
            console.log(`${FgCyan}📁 Exported to: ${incrementalFile}${Reset}`);

        } catch (err) {
            console.log(`${FgRed}❌ Failed to process ${networkName}: ${err.message}${Reset}`);
        }
    }

    console.log(`\n${Bright}📊 Summary:${Reset}`);
    console.log(`Total events found: ${FgGreen}${allEvents.length}${Reset}`);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`${FgRed}Error: ${error.message}${Reset}`);
        console.error(error);
        process.exit(1);
    });