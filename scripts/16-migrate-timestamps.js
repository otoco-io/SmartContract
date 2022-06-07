const fs = require('fs');
const { network } = require("hardhat");

async function main() {

    const [owner] = await ethers.getSigners();

    let companies = [];
    // Load companies data to fetch correct addresses linked to seriesIDs
    try {
        const data = fs.readFileSync(`./migrations_data/companies.${network.name}.json`, {encoding: "utf-8"});
        companies = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        process.exit(1);
    }

    let deploysJson;
    try {
        const data = fs.readFileSync(`./deploys/${network.name}.json`, {encoding: "utf-8"});
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        process.exit(1);
    }

    let previousJson
    // Import previous source contracts
    try {
        const data = fs.readFileSync(`./deploys/previous.${network.name}.json`, {encoding: "utf-8"});
        previousJson = JSON.parse(data);
    } catch (err) {
        previousJson = []
        console.log(err);
    }

    // Deploy Timestamp contract 
    const TimestampPluginFactory = await ethers.getContractFactory("Timestamp");
    const timestampPlugin = await TimestampPluginFactory.attach(deploysJson.timestamp);

    // Set old Token factory 
    let pluginABI = [{
        "anonymous": false,
        "inputs": [
        {
            "indexed": true,
            "internalType": "address",
            "name": "series",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "string",
            "name": "filename",
            "type": "string"
        },
        {
            "indexed": false,
            "internalType": "string",
            "name": "cid",
            "type": "string"
        }
        ],
        "name": "DocumentTimestamped",
        "type": "event"
    }];
    
    const contract = new ethers.Contract(previousJson.registry, pluginABI, owner);
    // Fetch events from old contracts
    const logs = await contract.queryFilter('DocumentTimestamped', 0, 'latest');
    const result = logs.map((l) => {
        // Assign SeriesIds from previous Series Contract 
        return {
            seriesId: companies.data.companies.findIndex((e) => e.id.toLowerCase() == l.args.series.toLowerCase()),
            timestamp: l.args.timestamp,
            filename: l.args.filename,
            cid: l.args.cid
        }
    })

    for (const t of result) {
        const encoded = ethers.utils.defaultAbiCoder.encode(
            ['string', 'string', 'uint256'],
            [t.filename, t.cid, t.timestamp]
        );
        await timestampPlugin.migrateTimestamp(t.seriesId, encoded)
    }

    console.log("🚀 All timestamp migrated:", timestampPlugin.address);
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});