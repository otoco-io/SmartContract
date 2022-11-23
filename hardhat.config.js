require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");
require('hardhat-contract-sizer');
require('solidity-coverage');
require('solidity-docgen');

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
      //hardfork: 'london'
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
