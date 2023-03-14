const { task } = require("hardhat/config");
require('dotenv').config();

require("./utils/accounts");
require("./utils/gas");
require("./utils/verification");

require("./jurisdictions");
require("./master");
require("./uri");
require("./postsetup");
require("./initializers");

task("setup", "OtoCo V2 scripts setup pusher")
  .setAction(async (undefined, hre) => {
    
    const jurisdictionSettings = require(`../scripts/jurisdiction-settings.json`)
    
    let settings
    switch (process.env.FORKED_NETWORK) {
      case "mainnet": settings = jurisdictionSettings.mainnet; break;
      case "polygon": settings = jurisdictionSettings.polygon; break;
      default: settings = jurisdictionSettings.default; break;
    }

     // Mine blocks automatically to allow use with front-end
     if (hre.network.config.chainId == 31337){
      await network.provider.send("evm_setIntervalMining", [5000]);
      await (await ethers.getSigner()).sendTransaction({
        to: '0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30',
        value: ethers.utils.parseEther("10"),
      });
    }

    // Deploy V2 Jurisdictions contracts
    const jurisdictions = await hre.run(
      "jurisdictions",
      { settings: JSON.stringify(settings) }
    );

    // Deploy/Migrate MasterV2 contract
    const master = await hre.run( "master", {
      jurisdictions: JSON.stringify(jurisdictions.map(({address} ) => address))
    });
    // Deploy tokenURI contract
    await hre.run("uri", {
      master: master.address
    });
    // Set required additional settings
    await hre.run("postsetup", {
      master: master.address,
      jurisdictions: JSON.stringify(jurisdictions.map(({address} ) => address)),
    });
    // Deploy Initializers contracts
    await hre.run("initializers", {});

  });

  module.exports = {
    solidity: "0.8.4",
  };