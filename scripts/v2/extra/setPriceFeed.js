const fs = require('fs');
const { network } = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";

const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";

async function main() {

  if (network.config.chainId == '31337') {
    throw new Error(`${Bright}${FgRed}Please choose a network that has a deployed Chainlink Price Feed contract instance.${Reset}`
      );
  }

  let deploysJson;
  let priceFeedAddr;
  let explorerUrl;

	// Load deployed master contract
	try {
		const data = fs.readFileSync(`./deploys/v2/${network.name}.json`, {encoding:"utf-8"});
		deploysJson = JSON.parse(data);
	} catch (err) {
		console.log(`${FgRed}Error loading Master address: ${err}${Reset}`);
		process.exit(1);
	}

  switch(network.name) {
    case "mainnet": 
      priceFeedAddr = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; 
      explorerUrl = "etherscan.io";
      break;
    case "polygon": 
      priceFeedAddr = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0"; 
      explorerUrl = "polygonscan.com";
      break;
    case "goerli": 
      priceFeedAddr = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"; 
      explorerUrl = "goerli.etherscan.io";
      break;
    case "polygon-mumbai": 
      priceFeedAddr = "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada"; 
      explorerUrl = "mumbai.polygonscan.com";
      break;
  }

  const signers = await ethers.getSigners();
  const masterInstance = 
    (await ethers.getContractFactory("OtoCoMasterV2")).attach(deploysJson.master);

  const tx = await masterInstance.connect(signers[0]).changePriceFeed(priceFeedAddr);
  console.log(`${Bright}${FgCyan}Transaction hash${Reset}`,
  `${FgMagenta}${tx.hash}${Reset} \n`);

  console.log(`Fetching transaction receipt...`);

  let receipt = null;

  while (receipt === null) {
    try {
      
      receipt = await tx.wait()

      if (receipt === null) {
        console.log(`Trying again to fetch transaction receipt...`);

        continue;
      }

      console.log(`${Bright}Receipt confirmations:`, receipt.confirmations);

      console.info(
        `${FgGreen}Transaction receipt :`,
        `https://${explorerUrl}/tx/${receipt.transactionHash}${Reset}`
      );
    } catch (e) {
      console.log(`${FgRed}${Bright}Receipt error:`, e, `${Reset}`);
      break;
    }
  }
}

main()
.then(() => process.exit(0))
.catch((error) => {
	console.error(error);
	process.exit(1);
});

