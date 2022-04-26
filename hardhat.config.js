/**
 * @type import('hardhat/config').HardhatUserConfig
 */

 require('@openzeppelin/hardhat-upgrades');
 require('solidity-coverage')
 
module.exports = {
  solidity: "0.8.3",
  networks: {
    hardhat: {
      //gas: 2000000
    },
  }
};
