const hre = require("hardhat");

async function main() {
    const contractAddress = "0xe8C81680F1D1aee6299A93B6a1eF31e6b8D2BC1F";
    
    console.log("Connecting to OtoCoMasterV3 contract at:", contractAddress);
    
    const MasterFactory = await hre.ethers.getContractFactory("OtoCoMasterV3");
    const master = MasterFactory.attach(contractAddress);
    
    console.log("Calling initialize function with empty array [] and empty string ''");
    
    const tx = await master.initialize([], "");
    
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("✅ Initialize function called successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
