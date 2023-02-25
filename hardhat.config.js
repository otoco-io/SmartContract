require("@nomicfoundation/hardhat-chai-matchers");
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");
require('hardhat-contract-sizer');
require('solidity-coverage');
require('solidity-docgen');
require("hardhat-tracer");
// require("hardhat-gas-reporter");

require('dotenv').config();
// require("./tasks/setup");

// const fs = require('fs');
// const apiMain = fs.readFileSync(".api.main").toString().trim();
// const apiRopsten = fs.readFileSync(".api.ropsten").toString().trim();
// const apiRinkeby = fs.readFileSync(".api.rinkeby").toString().trim();
// const apiMumbai = fs.readFileSync(".api.mumbai").toString().trim();
// const apiGoerli = fs.readFileSync(".api.goerli").toString().trim();
// const apiPolygon = fs.readFileSync(".api.polygon").toString().trim();
// const seedMain = fs.readFileSync(".secret.main").toString().trim();

module.exports = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      blockGasLimit: 30000000,
      accounts: process.env.MNEMONIC_PHRASE ? {
        mnemonic: process.env.MNEMONIC_PHRASE,
      } : undefined,
      forking: process.env.FORK_ENABLED === "true" ? {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      } : undefined,
    },
    // main: {
    //   url: apiMain,
    //   accounts: {
    //     mnemonic: seedMain,
    //     count: 1
    //   }
    // },
    // ropsten: {
    //   url: apiRopsten,
    //   accounts: {
    //     mnemonic: seedMain,
    //     count: 1
    //   }
    // },
    // rinkeby: {
    //   url: apiRinkeby,
    //   accounts: {
    //     mnemonic: seedMain,
    //     count: 1
    //   }
    // },
    // mumbai: {
    //   url: apiMumbai,
    //   accounts: {
    //     mnemonic: seedMain,
    //     count: 1
    //   }
    // },
    // polygon: {
    //   url: apiPolygon,
    //   accounts: {
    //     mnemonic: seedMain,
    //     count: 1
    //   }
    // },
    // goerli: {
    //   url: apiGoerli,
    //   accounts: {
    //     mnemonic: seedMain,
    //     count: 1
    //   }
    // }
  }
};
