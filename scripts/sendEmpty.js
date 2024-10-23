const { network } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    // Get your address
    const myAddress = await signer.getAddress();
    // To address (can be any address)
    const toAddress = signer.getAddress(); // Replace with desired recipient address

    const tx = {
        from: myAddress,
        to: toAddress,
        data: "0x", // Empty data for simple transaction
    };

    console.log("Sending transaction...");

    const sentTx = await signer.sendTransaction(tx);

    console.log("Transaction hash:", sentTx.hash);
    console.log("Waiting for confirmation...");

    await sentTx.wait();

    console.log("Transaction confirmed at block:", sentTx.blockNumber);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});