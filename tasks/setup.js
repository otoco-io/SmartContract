const { task } = require("hardhat/config");
require('dotenv').config();

require("./jurisdictions");

const urlBuild = 
  `https://eth-` +
  `${process.env.FORKED_NETWORK}` + 
  `.g.alchemy.com/v2/` + 
  `${process.env.ALCHEMY_KEY}`;

const jurisdictionPrices = { 
  up: process.env.UNINCORPORATED_PRICES, 
  dp: process.env.DELAWARE_PRICES,
  wp: process.env.WYOMING_PRICES,
};

if(!urlBuild || !jurisdictionPrices) {
  throw new Error("Please set your task config in a .env file");
}

task("setup", "OtoCo V2 scripts setup pusher")
  .setAction(async (undefined, hre) => {

  if(process.env.FORK_ENABLED != "false") {
    await network.provider.request({
      method: "hardhat_reset",
      params: [{ forking: { jsonRpcUrl: urlBuild } }],
    });
  };
    
    await hre.run( "jurisdictions", jurisdictionPrices );
    
  });

  module.exports = {
    solidity: "0.8.4",
  };