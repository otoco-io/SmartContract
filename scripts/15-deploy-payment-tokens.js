const fs = require('fs');
const { network, ethers } = require("hardhat");

async function main() {

    const [owner] = await ethers.getSigners();

    let deploysJson;
    try {
        const data = fs.readFileSync(`./deploys/${network.name}.json`, {encoding: "utf-8"});
        deploysJson = JSON.parse(data);
    } catch (err) {
        console.log('Not possible to load Deploy files. Will create one.', err);
        process.exit(1);
    }

    // Set master contract based on file loaded
     const tokenPlugin = (await ethers.getContractFactory("Token")).attach(deploysJson.token);
     const otocoMaster = (await ethers.getContractFactory("OtoCoMaster")).attach(deploysJson.master);

     const gasPrice = ethers.BigNumber.from("2000000000");
     const gasLimit = ethers.BigNumber.from("350000");
     const otocoBaseFee = await otocoMaster.baseFee();
 
     const amountToPay = ethers.BigNumber.from(gasPrice).mul(gasLimit).div(otocoBaseFee);

     // Create DAI token to use as payment on launchpool
     encoded = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('8000000'), 'Test DAI', 'DAI', owner.address]
      );
      await tokenPlugin.addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay})
      // Create USDC token to use as payment on launchpool
      encoded = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('8000000'), 'Test USDC', 'USDC', owner.address]
      );
      await tokenPlugin.addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay})
      // Create USDT token to use as payment on launchpool
      encoded = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'string', 'string', 'address'],
        [ethers.utils.parseEther('8000000'), 'Test Token', 'USDT', owner.address]
      );
      await tokenPlugin.addPlugin(0, encoded, {gasPrice, gasLimit, value:amountToPay})

      const daiToken = await tokenPlugin.tokensDeployed(0,0);
      const usdcToken = await tokenPlugin.tokensDeployed(0,1);
      const usdtToken = await tokenPlugin.tokensDeployed(0,2);

     console.log("🚀 DAI TOKEN:", daiToken);
     console.log("🚀 USDC TOKEN:", usdcToken);
     console.log("🚀 USDT TOKEN:", usdtToken);
     deploysJson.dai = daiToken
     deploysJson.usdc = usdcToken
     deploysJson.usdt = usdtToken
 
     fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(deploysJson, undefined, 2));

}
    
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});