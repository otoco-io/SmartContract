require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-ethers");
require('hardhat-contract-sizer');
require('solidity-coverage');
require('solidity-docgen');
require("hardhat-tracer");

require('dotenv').config();
require("./tasks/setup");
// require("hardhat-gas-reporter");


process.removeAllListeners('warning');

const chainIds = {
  hardhat: 31337,
  mainnet: 1,
  goerli: 5,
  polygon: 137,
  mumbai: 80001,
  sepolia: 11155111,
  base: 8453,
  basesepolia: 84532
};

function getChainConfig(chain) {

  const jsonRpcUrl = process.env[`RPC_${chain.toUpperCase()}_API`]
  if (!jsonRpcUrl) throw new Error("API KEY not fount for " + chain);

  return {
    // Comment out for default hardhat account settings
    accounts: {
      count: 10,
      mnemonic: process.env.MNEMONIC_PHRASE,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[chain],
    url: jsonRpcUrl
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
        url: getChainConfig(process.env.FORKED_NETWORK).url,
      } : undefined,
    },
    mainnet: getChainConfig("mainnet"),
    goerli: getChainConfig("goerli"),
    polygon: getChainConfig("polygon"),
    mumbai: getChainConfig("mumbai"),
    sepolia: getChainConfig("sepolia"),
    basesepolia: getChainConfig("basesepolia"),
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      basesepolia: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "basesepolia",
        chainId: chainIds.basesepolia,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org/"
        }
      },
      {
        network: "base",
        chainId: chainIds.base,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
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
