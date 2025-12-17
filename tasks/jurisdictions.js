const { task } = require("hardhat/config");

// deploy via cli:
// e.g.:
//    npx hardhat jurisdictions --network localhost
task("jurisdictions", "Deploys OtoCo V2 Jurisdictions")
  .addParam("master", "The current instance of OtoCoMasterV2")
  // Jurisdiction setting to be deployed stringified
  .addParam("settings", "The V2 jurisdiction settings")
  .addOptionalParam("predeployed", "Previous jurisdictions to be skipped", "[]")
  .setAction(async (taskArgs) => {
    const deployer =
      hre.network.config.chainId == 31337 && process.env.FORK_ENABLED == "true"
        ? await ethers.getImpersonatedSigner(
          "0x1216a72b7822Bbf7c38707F9a602FC241Cd6df30"
        )
        : await ethers.getSigner();

    const jurisdictions = JSON.parse(taskArgs.settings);
    const predeployed = JSON.parse(taskArgs.predeployed);
    console.log(predeployed);

    factoryNames = [
      "JurisdictionUnincorporatedV2",
      "JurisdictionDelawareV2",
      "JurisdictionWyomingV2",
      "JurisdictionSwissAssociationV2",
      "JurisdictionMarshallIslandsV2",
      "JurisdictionUnaDunaV2",
      "JurisdictionDelawareLLCV2",
      "JurisdictionWyomingLLCV2"
    ];

    let contracts = [];

    // Deploying contract
    for (const [idx, j] of jurisdictions.entries()) {
      const jurisdictionFactory = await ethers.getContractFactory(
        factoryNames[idx],
        deployer
      );
      let jurisdictionInstance;
      if (predeployed[idx]) {
        jurisdictionInstance = await jurisdictionFactory.attach(
          predeployed[idx]
        );
        const jurisdictionData = [];
        try {
          jurisdictionData.push(
            (
              await jurisdictionInstance.callStatic.getJurisdictionDeployPrice()
            ).toString()
          );
          jurisdictionData.push(
            (
              await jurisdictionInstance.callStatic.getJurisdictionRenewalPrice()
            ).toString()
          );
          jurisdictionData.push(
            (
              await jurisdictionInstance.callStatic.getJurisdictionClosePrice()
            ).toString()
          );
          jurisdictionData.push(
            (
              await jurisdictionInstance.callStatic.getJurisdictionGoldBadge()
            ).toString()
          );
          jurisdictionData.push(
            (
              await jurisdictionInstance.callStatic.getJurisdictionBadge()
            ).toString()
          );
          console.log(jurisdictionData);
        } catch (err) {
          // If some of the calls above fails, ignore the rest since it has to be redeployed
          console.log(
            `Predeployed ${jurisdictions[idx].name} fails to return some of the properties required on V2.`
          );
        }
        const settingsData = [
          jurisdictions[idx].deployPrice.toString(),
          jurisdictions[idx].renewPrice.toString(),
          jurisdictions[idx].closePrice.toString(),
          jurisdictions[idx].goldBadge.toString(),
          jurisdictions[idx].defaultBadge.toString(),
        ];
        if (JSON.stringify(jurisdictionData) == JSON.stringify(settingsData)) {
          console.log(
            `Jurisdiction ${jurisdictions[idx].name} exactly the same, will skip redeploy.`
          );
          contracts.push(jurisdictionInstance);
          continue;
        }
      }
      console.log(
        `Jurisdiction ${jurisdictions[idx].name} not equal, will redeploy.`
      );
      
      // Debug: Check nonce before deployment
      const currentNonce = await ethers.provider.getTransactionCount(deployer.address);
      console.log("=== Nonce Debug ===");
      console.log("Deployer Address:", deployer.address);
      console.log("Current Wallet Nonce:", currentNonce);
      
      // Debug: Check gas price before deployment
      const feeData = await ethers.provider.getFeeData();
      console.log("=== Gas Price Debug ===");
      console.log("Gas Price:", ethers.utils.formatUnits(feeData.gasPrice || 0, 'gwei'), "gwei");
      console.log("Max Fee Per Gas:", ethers.utils.formatUnits(feeData.maxFeePerGas || 0, 'gwei'), "gwei");
      console.log("Max Priority Fee:", ethers.utils.formatUnits(feeData.maxPriorityFeePerGas || 0, 'gwei'), "gwei");
      
      // Polygon requires minimum 25 gwei priority fee, ensure we meet that
      const minPriorityFee = ethers.utils.parseUnits('60', 'gwei'); // 30 gwei to be safe
      const priorityFee = feeData.maxPriorityFeePerGas?.mul(2).lt(minPriorityFee) 
        ? minPriorityFee 
        : feeData.maxPriorityFeePerGas.mul(1);
      
      // Deploy with DOUBLE gas price from chain for faster confirmation
      const deployOptions = feeData.maxFeePerGas 
        ? {
            maxFeePerGas: feeData.maxFeePerGas.mul(5),
            maxPriorityFeePerGas: priorityFee
          }
        : {
            gasPrice: feeData.gasPrice.mul(5)
          };
      
      console.log("Using DOUBLED gas price for deployment:");
      if (deployOptions.maxFeePerGas) {
        console.log("Max Fee Per Gas (2x):", ethers.utils.formatUnits(deployOptions.maxFeePerGas, 'gwei'), "gwei");
        console.log("Max Priority Fee (adjusted):", ethers.utils.formatUnits(deployOptions.maxPriorityFeePerGas, 'gwei'), "gwei");
      } else {
        console.log("Gas Price (2x):", ethers.utils.formatUnits(deployOptions.gasPrice, 'gwei'), "gwei");
      }
      
      // deployOptions.nonce = currentNonce;
      jurisdictionInstance = await jurisdictionFactory.deploy(
        ...Object.values(j),
        {nonce: currentNonce}
      );
      
      // Debug: Check actual gas price used in deployment transaction
      console.log("Deployment Tx Hash:", jurisdictionInstance.deployTransaction.hash);
      console.log("Deployment Tx Nonce:", jurisdictionInstance.deployTransaction.nonce);
      if (jurisdictionInstance.deployTransaction.maxFeePerGas) {
        console.log("✓ EIP-1559 Transaction:");
        console.log("  Max Fee Per Gas:", ethers.utils.formatUnits(jurisdictionInstance.deployTransaction.maxFeePerGas, 'gwei'), "gwei");
        console.log("  Max Priority Fee:", ethers.utils.formatUnits(jurisdictionInstance.deployTransaction.maxPriorityFeePerGas || 0, 'gwei'), "gwei");
      } else {
        console.log("✓ Legacy Transaction:");
        console.log("  Gas Price:", ethers.utils.formatUnits(jurisdictionInstance.deployTransaction.gasPrice || 0, 'gwei'), "gwei");
      }
      
      await jurisdictionInstance.deployed();
      
      // Debug: Get deployment receipt details
      const deployReceipt = await jurisdictionInstance.deployTransaction.wait();
      console.log("Gas Used:", deployReceipt.gasUsed.toString());
      console.log("Effective Gas Price:", ethers.utils.formatUnits(deployReceipt.effectiveGasPrice || 0, 'gwei'), "gwei");
      console.log("Total Cost (ETH):", ethers.utils.formatEther(deployReceipt.gasUsed.mul(deployReceipt.effectiveGasPrice || 0)));
      console.log("======================");
            
      contracts.push(jurisdictionInstance);
    }

    // Setting addresses on mainnet
    const master = (await ethers.getContractFactory("OtoCoMasterV2")).attach(
      taskArgs.master
    );
    let transaction;
    for (const [idx, j] of contracts.entries()) {
      if (predeployed[idx]) {
        if (j.address != predeployed[idx]) {
          console.log("Will update from ", j.address, " to ", predeployed[idx]);
          transaction = await master
            .connect(deployer)
            .updateJurisdiction(idx, j.address);
          await transaction.wait(1);
        } else {
          console.log(
            "Same address for ",
            idx,
            " will keep ",
            predeployed[idx]
          );
        }
        const jurisdictionSet = (
          await master.callStatic.jurisdictionAddress(idx)
        ).toString();
        if (jurisdictionSet != j.address) {
          transaction = await master
            .connect(deployer)
            .updateJurisdiction(idx, j.address);
          await transaction.wait(1);
        } else {
          console.log("Same address for ", idx, " will keep ", j.address);
        }
        continue;
      }
      console.log("Will add jurisdiction", idx, j.address);
      transaction = await master.connect(deployer).addJurisdiction(j.address);
      await transaction.wait(1);
    }

    return contracts;
  });
