const { task } = require("hardhat/config");

const br = "\x1b[1m";
const gr = "\x1b[32m";
const red = "\x1b[31m";
const r = "\x1b[0m";

const defaultMaxTries = "8";
const defaultDelayTime = "10000";
const defaultArgs = "[]";


async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

task(
  "verification", 
  "Handles verification of deployed contracts")

.addParam(
  "addr", 
  "The address of a deployed contract instance")
  
.addOptionalParam(
    "args",
    "The constructor arguments used in deployment",
    defaultArgs
).addOptionalParam(
  "tries", 
  "The number of verification tries",
  defaultMaxTries
).addOptionalParam(
  "delay", 
  "The wait time before verification",
  defaultDelayTime
)


.setAction(async (taskArgs, hre) => {
  let count = 0;
  do {
    await delay(Number(taskArgs.delay));
    try {
      console.log(
        `${br}Verifying contract at address` +
        `${taskArgs.addr}${r}`
      );
      await hre.run('verify:verify', {
        address: taskArgs.addr,
        constructorArguments: JSON.parse(taskArgs.args)
      });
      console.log(
        `${br}${gr}Contract at address` +
        `${taskArgs.addr} has already been verified${r}`);
      break;
    } catch (error) {
      if (
        String(error).includes('Already Verified')  || 
        String(error).includes('ProxyAdmin')
      ) {
        console.log(
          `${br}${gr}Contract at address ` + 
          `${taskArgs.addr} has already been verified${r}`);
        break; 
      };
      console.log(
        `${br}Retrying verification of contract at address` +
        `${taskArgs.addr} - attempt #${++count}, error: ${red}${error}${r}`
      );
      if (count === Number(taskArgs.tries)) 
        console.log(
          `${br}${red}Failed to verify contract at address` +
          `${taskArgs.addr} after ${count} attempts, error: ${error}${r}`);
    }
  } while (count < Number(taskArgs.tries));
});