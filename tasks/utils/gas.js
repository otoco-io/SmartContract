const { task } = require("hardhat/config");
const axios = require('axios');
require('dotenv').config();

const apiKeys = [process.env.ETHERSCAN_API_KEY, process.env.POLYGONSCAN_API_KEY];

task("gas", "Estimate gas price data from block explorer apis")
.addFlag("mainnet", "Prints Ethereum Mainnet gas information")
.addFlag("polygon", "Prints Polygon Mainnet gas information")

.setAction(async ({mainnet, polygon}, hre) => {

  const formatGasPrice = (gasPrice) => `${gasPrice} GWei`;

  if(mainnet) {
    const baseUrl = `https://api.etherscan.io/api?module=gastracker&action=`;

    const ethGasQuery = 
      `${baseUrl}gasoracle&apikey=${apiKeys[0]}`;
    
    const 
    { 
      SafeGasPrice, 
      ProposeGasPrice, 
      FastGasPrice, 
      LastBlock, 
      suggestBaseFee, 
      gasUsedRatio,
    } = (await axios.get(ethGasQuery)).data.result;

    const gasPriceWei 
    = [
      SafeGasPrice, 
      ProposeGasPrice, 
      FastGasPrice 
    ].map(
      price => 
      hre.ethers.utils.parseUnits(
        parseInt(price).toString(), 
        "gwei"
      ).toString(),
    );
      
    const gasPriceTimeQuery = 
    gasPriceWei.map(price => 
      `${baseUrl}gasestimate&gasprice=${price}&apikey=${apiKeys[0]}`);
    
    const [
      safeEthTimeInfo, 
      proposeEthTimeInfo, 
      fastEthTimeInfo
    ] = (
    await axios.all(
      gasPriceTimeQuery
      .map(url => axios.get(url))))
      .map(response => response.data.result,
    );
      
    const responseTable = {
      "Last Block Mined": LastBlock,
      "Safe Gas Price": formatGasPrice(SafeGasPrice) 
        + ` (Estimated Time: ${safeEthTimeInfo}s)`,
      "Propose Gas Price": formatGasPrice(ProposeGasPrice) 
        + ` (Estimated Time: ${proposeEthTimeInfo}s)`,
      "Fast Gas Price": formatGasPrice(FastGasPrice) 
        + ` (Estimated Time: ${fastEthTimeInfo}s)`,
      "Next Block's Base Fee": formatGasPrice(suggestBaseFee),
      "Gas Usage ratio (Last 5 Blocks)": gasUsedRatio,
    };

    console.table(responseTable);
  }

  if(polygon) {

    const baseUrl = `https://api.polygonscan.com/api?module=gastracker&action=`;

    const polygonGasQuery = 
      `${baseUrl}gasoracle&apikey=${apiKeys[1]}`;
    
    const 
    { 
      LastBlock, 
      SafeGasPrice, 
      ProposeGasPrice, 
      FastGasPrice, 
      suggestBaseFee, 
      gasUsedRatio,
    } = (await axios.get(polygonGasQuery)).data.result;

      
    const responseTable = {
      "Last Block Mined": LastBlock,
      "Safe Gas Price": formatGasPrice(SafeGasPrice),
      "Propose Gas Price": formatGasPrice(ProposeGasPrice), 
      "Fast Gas Price": formatGasPrice(FastGasPrice),
      "Next Block's Base Fee": formatGasPrice(suggestBaseFee),
      "Gas Usage ratio (Last 5 Blocks)": gasUsedRatio,
    };

    console.table(responseTable);
  }

});