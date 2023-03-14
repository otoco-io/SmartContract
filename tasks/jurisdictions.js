const { task } = require("hardhat/config");

// deploy via cli:
// e.g.:
//    npx hardhat jurisdictions --network localhost 
task("jurisdictions", "Deploys OtoCo V2 Jurisdictions")
// Jurisdiction setting to be deployed stringified
.addParam("settings", "The V2 jurisdiction settings")

.setAction(async (taskArgs) => {

  const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
  await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
  : await ethers.getSigner()  

  const jurisdictions = JSON.parse(taskArgs.settings)

  factoryNames = [
    'JurisdictionUnincorporatedV2',
    'JurisdictionDelawareV2',
    'JurisdictionWyomingV2'
  ]

  let contracts = [];
  for (const [idx,j] of jurisdictions.entries()) {
    const jurisdictionFactory = await ethers.getContractFactory(factoryNames[idx], deployer)
    const jurisdictionInstance = await jurisdictionFactory.deploy(...Object.values(j));
    await jurisdictionInstance.deployed();

    contracts.push(jurisdictionInstance);
  }

  return contracts;
});
