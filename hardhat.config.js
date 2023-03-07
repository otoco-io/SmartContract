require("@nomicfoundation/hardhat-chai-matchers");
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");
require('hardhat-contract-sizer');
require('solidity-coverage');
require('solidity-docgen');
require("hardhat-tracer");

require('dotenv').config();
require("./tasks/setup");
// require("hardhat-gas-reporter");


const alchemyApiKey = process.env.ALCHEMY_KEY;
if (!alchemyApiKey) {
  throw new Error("Please set your ALCHEMY_KEY in a .env file");
}

const urlBuild = 
  `https://eth-` +
  `${process.env.FORKED_NETWORK}` + 
  `.g.alchemy.com/v2/` + 
  `${process.env.ALCHEMY_KEY}`;

const chainIds = {
    hardhat: 31337,
    mainnet: 1,
    goerli: 5,
    polygon: 137,
    "polygon-mumbai": 80001,
  };

  function getChainConfig(chain){
    let jsonRpcUrl;
    switch (chain) {
      case "polygon-mumbai":
        jsonRpcUrl =
          "https://polygon-mumbai.g.alchemy.com/v2/" +
          alchemyApiKey;
        break;
        case "polygon-mainnet":
        jsonRpcUrl =
          "https://polygon-mainnet.g.alchemy.com/v2/" +
          alchemyApiKey;
        break;
      default:
        jsonRpcUrl =
          "https://eth-" + chain + ".g.alchemy.com/v2/" + alchemyApiKey;
    }
    return {
      // Comment out for default hardhat account settings
      accounts: {
        count: 10,
        mnemonic: process.env.MNEMONIC_PHRASE,
        path: "m/44'/60'/0'/0",
      },
      chainId: chainIds[chain],
      url: jsonRpcUrl,
    };
  }


module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: { chainId: chainIds.hardhat },
    hardhat: {
      blockGasLimit: 30000000,
      chainId: chainIds.hardhat,
      accounts: process.env.MNEMONIC_PHRASE ? {
        mnemonic: process.env.MNEMONIC_PHRASE,
        path: "m/44'/60'/0'/0",
      } : undefined,
      forking: process.env.FORK_ENABLED === "true" ? {
        url: urlBuild,
      } : undefined,
    },
    mainnet: getChainConfig("mainnet"),
    goerli: getChainConfig("goerli"),
    polygon: getChainConfig("polygon-mainnet"),
    "polygon-mumbai": getChainConfig("polygon-mumbai"),
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
  solidity: {
    compilers: [
      { version: "0.8.0" },
      { version: "0.8.4" },
    ],
      settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: false,
        // runs: 2_000,
      },
    },
  },
};
