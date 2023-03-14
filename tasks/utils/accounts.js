const { task } = require("hardhat/config");

task("accounts", `Prints the list of accounts`, async (undefined, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});