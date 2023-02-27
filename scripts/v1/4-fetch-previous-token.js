const fs = require('fs');
const { ethers, network } = require("hardhat");
const { zeroAddress } = require("ethereumjs-util");

async function main() {

  [signer] = await ethers.getSigners();

  let companies,deploys;

  // Load companies data to fetch correct addresses linked to seriesIDs
  try {
    const data = fs.readFileSync(`./migrations_data/companies.${network.name}.json`, {encoding: "utf-8"});
    companies = JSON.parse(data);
  } catch (err) {
    console.log('Not possible to load Deploy files. Will create one.', err);
    process.exit(1);
  }

  // Load previous plugin contract addresses
  try {
    const data = fs.readFileSync(`./deploys/v1/previous.${network.name}.json`, {encoding: "utf-8"});
    deploys = JSON.parse(data);
  } catch (err) {
    console.log('Not possible to load Deploy files. Will create one.', err);
    process.exit(1);
  }

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
        "indexed": true,
        "internalType": "uint16",
        "name": "key",
        "type": "uint16"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "value",
        "type": "address"
      }
    ],
    "name": "RecordChanged",
    "type": "event"
  }];

  const contract = new ethers.Contract(deploys.registry, pluginABI, signer);
  // Fetch events from old contracts
  const filter = contract.filters.RecordChanged(null, 1);
  const logs = await contract.queryFilter(filter, 0, 'latest');
  const result = logs.map((l) => {
    // Assign SeriesIds from previous Series Contract 
    return {
      seriesId: companies.data.companies.findIndex((e) => e.id.toLowerCase() == l.args.series.toLowerCase()),
      address: l.args.value
    }
  })

  const removals = result.filter((l) => { return l.address == zeroAddress() })
  const resultFiltered = result.filter((l) => { return l.address != zeroAddress() })

  while (removals.length > 0) {
    const removed = removals.shift();
    const index = resultFiltered.findIndex( (e) => e.seriesId == removed.seriesId )
    resultFiltered.splice(index, 1);
  }

  // Count how much SeriesIds assigning got failed
  // This value should be always 0. If doesn't the fetch from companies should be re-done.
  const failed = resultFiltered.reduce((acc, curr) => {
    return curr.seriesId >= 0 ? acc : acc+1
  }, 0)

  fs.writeFileSync(`./migrations_data/token.${network.name}.json`, JSON.stringify(resultFiltered, undefined, 2));
  console.log(`💾  Sucessfully stored a total of ${resultFiltered.length} Tokens deployed with ${failed} unrecognized Series.`)
}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});