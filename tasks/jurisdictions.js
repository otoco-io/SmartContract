const { task } = require("hardhat/config");


const ipfsUrl = 
  'ipfs://Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR';

const defaultDAOData = 
  `["DAO", "${ipfsUrl}/dao_default.png", "${ipfsUrl}/dao_gold.png"]`;

const defaultDEData = 
  `["DELAWARE", "${ipfsUrl}/de_default.png", "${ipfsUrl}/de_gold.png"]`;

const defaultWYData = 
  `["WYOMING", "${ipfsUrl}/wy_default.png", "${ipfsUrl}/wy_gold.png"]`;

// deploy via cli:
// e.g.:
//    npx hardhat jurisdictions 
//      --network localhost --up "[0,2]" --dp "[5,5]" --wp "[50,40]"
task("jurisdictions", "Deploys OtoCo V2 Jurisdictions")

// uncPrice || dePrice || wyPrice := [renewPrice, deployPrice]
.addParam(
  "up", "The UnincorporatedV2 price array")
.addParam(
  "dp", "The DelawareV2 price array")
.addParam(
  "wp", "The WyomingV2 price array")

// leave empty for default values
.addOptionalParam(
  "ud", 
  "The UnincorporatedV2 data array", 
  defaultDAOData
).addOptionalParam(
  "dd", 
  "The DelawareV2 data array", 
  defaultDEData
).addOptionalParam(
  "wd", 
  "The WyomingV2 data array", 
  defaultWYData
)

.setAction(async (taskArgs) => {

  const signers = await ethers.getSigners();
// console.log(defaultDAOData)
  const jurisdictions = [
    { 
      name: 'unincorporated', 
      args: [...JSON.parse(taskArgs.up), ...JSON.parse(taskArgs.ud)], 
      contractName: 'JurisdictionUnincorporatedV2' 
    },
    { 
      name: 'delaware', 
      args: [...JSON.parse(taskArgs.dp), ...JSON.parse(taskArgs.dd)], 
      contractName: 'JurisdictionDelawareV2' 
    },
    { 
      name: 'wyoming', 
      args: [...JSON.parse(taskArgs.wp), ...JSON.parse(taskArgs.wd)], 
      contractName: 'JurisdictionWyomingV2' 
    },
  ];
  
  let contracts = [];
  for (const jurisdiction of jurisdictions) {
    const contract = await 
    (await ethers.getContractFactory(jurisdiction.contractName))
    .connect(signers[0]).deploy(...jurisdiction.args);
    
    await contract.deployTransaction.wait(1);
    await contract.deployed();

    contracts.push(contract);
  }

  return contracts;
});

module.exports = {
  solidity: "0.8.4",
};