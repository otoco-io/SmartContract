const { task } = require("hardhat/config");

// deploy via cli:
// e.g.:
//    npx hardhat jurisdictions --network localhost 
task("jurisdictions", "Deploys OtoCo V2 Jurisdictions")
.addParam("master", "The current instance of OtoCoMasterV2")
// Jurisdiction setting to be deployed stringified
.addParam("settings", "The V2 jurisdiction settings")
.addOptionalParam("predeployed", "Previous jurisdictions to be skipped", '[]')
.setAction(async (taskArgs) => {

  const deployer = hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true" ?
  await ethers.getImpersonatedSigner("0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30")
  : await ethers.getSigner()  

  const jurisdictions = JSON.parse(taskArgs.settings)
  const predeployed = JSON.parse(taskArgs.predeployed)
  console.log(predeployed)

  factoryNames = [
    'JurisdictionUnincorporatedV2',
    'JurisdictionDelawareV2',
    'JurisdictionWyomingV2',
    'JurisdictionUnincorporatedV2'
  ]

  let contracts = [];

  // Deploying contract
  for (const [idx,j] of jurisdictions.entries()) {
    const jurisdictionFactory = await ethers.getContractFactory(factoryNames[idx], deployer)
    let jurisdictionInstance;
    if (predeployed[idx]) {
      jurisdictionInstance = await jurisdictionFactory.attach(predeployed[idx]);
      const jurisdictionData = [
        (await jurisdictionInstance.callStatic.getJurisdictionDeployPrice()).toString(),
        (await jurisdictionInstance.callStatic.getJurisdictionRenewalPrice()).toString(),
        (await jurisdictionInstance.callStatic.getJurisdictionGoldBadge()).toString(),
        (await jurisdictionInstance.callStatic.getJurisdictionBadge()).toString()
      ]
      const settingsData = [
        jurisdictions[idx].deployPrice.toString(),
        jurisdictions[idx].renewPrice.toString(),
        jurisdictions[idx].goldBadge.toString(),
        jurisdictions[idx].defaultBadge.toString(),
      ]
      if (JSON.stringify(jurisdictionData) == JSON.stringify(settingsData)){
        contracts.push(jurisdictionInstance);
        continue
      }
    }
    console.log('Not equal will redeploy', idx)
    jurisdictionInstance = await jurisdictionFactory.deploy(...Object.values(j));
    await jurisdictionInstance.deployed();
    contracts.push(jurisdictionInstance);
  }

  // Setting addresses on mainnet
  const master = (await ethers.getContractFactory("OtoCoMasterV2")).attach(taskArgs.master);
  let transaction
  for (const [idx,j] of contracts.entries()) {
    if (predeployed[idx]) {
      if (j.address != predeployed[idx]){
        console.log('Will update from ',j.address,' to ', predeployed[idx])
        transaction = await master.connect(deployer).updateJurisdiction(idx, j.address)
        await transaction.wait(1); 
      } else {
        console.log('Same address for ',idx,' will keep ', predeployed[idx])
      }
      continue
    }
    console.log('Will add jurisdiction', idx, j.address )
    transaction = await master.connect(deployer).addJurisdiction(j.address);
    await transaction.wait(1);
  }

  return contracts;
});
