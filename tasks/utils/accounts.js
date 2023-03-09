const { task } = require("hardhat/config");

const fc = "\x1b[30m";
const bg = "\x1b[44m";
const br = "\x1b[1m";
const r = "\x1b[0m";

task(`accounts`, `${fc}${bg}${br}Prints the list of accounts${r}`, async (undefined, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});