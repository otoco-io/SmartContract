const fs = require('fs');
const { network } = require("hardhat");
const hre = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";
const FgGreen = "\x1b[32m";
const FgRed = "\x1b[31m";

async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {

    let object = {}
    let badges = {}

    try {
        badges = JSON.parse(fs.readFileSync(
            "./scripts/v2/jurisdiction-badges.json",
            {encoding:"utf-8"},
        ));
    } catch (err) {
        console.log(
            `${FgRed}Error loading jurisdiction badges: ${err}${Reset}`
        );
		process.exit(1);
    }
    
    const uncPrice = "[0,2]"; 
    const dePrice = "[5,5]";
    const wyPrice = "[50,40]";

    let unincorporated, delaware, wyoming;
    
    switch (network.name) {
        case "mainnet": badges = badges?.mainData; break;
        case "polygon": badges = badges?.polygonData; break;
        default: badges = badges?.defaultData; break;
    }
    
    const uncData = 
    JSON.stringify(Object.values(badges[0]));
    const deData = 
    JSON.stringify(Object.values(badges[1]));
    const wyData = 
    JSON.stringify(Object.values(badges[2]));
    
    [unincorporated, delaware, wyoming] = 
    await hre.run( "jurisdictions", { 
        up: uncPrice, 
        dp: dePrice, 
        wp: wyPrice, 
        ud: uncData,
        dd: deData,
        wd: wyData,
    });

    const jurisdictions = [unincorporated, delaware, wyoming];
    
    object.jurisdictions = jurisdictions.map(({ address }) => address);
    
    const [deployer] = await ethers.getSigners();
    console.log(`${Bright}👤 Contract deployed with ${deployer.address}${Reset}`, "\n");
    
    const jurisdictionData = {};
    
    for (const jurisdiction of jurisdictions) {
        const renewalPrice = 
            (await jurisdiction.callStatic.getJurisdictionRenewalPrice()).toString();
        const deployPrice = 
            (await jurisdiction.callStatic.getJurisdictionDeployPrice()).toString();
        const name = 
            (await jurisdiction.callStatic.getJurisdictionName()).toString();
        const defaultBadge = 
            (await jurisdiction.callStatic.getJurisdictionBadge()).toString();
        const goldBadge = 
            (await jurisdiction.callStatic.getJurisdictionGoldBadge()).toString();
        jurisdictionData[jurisdiction.address] = 
            { renewalPrice, deployPrice, name, defaultBadge, goldBadge };
    }

    console.log(`${Bright}🚀 OtoCo V2 Jurisdictions Deployed:${Reset}`, jurisdictionData);
        
    fs.writeFileSync(
        `./deploys/v2/${network.name}.json`, 
        JSON.stringify(object, undefined, 2),
    );

    if (network.config.chainId != '31337') {
        const maxTries = 8;
        const delayTime = 10000;
        let count = 0;
        for (const jurisdiction of jurisdictions) {
        do {
            await delay(delayTime);
            try {
                console.log(
                    `${Bright}Verifying contract at address` +
                    `${jurisdiction.address}${Reset}`
                );
                await hre.run('verify:verify', {
                    address: jurisdiction.address,
                    constructorArguments: 
                        Object.values(jurisdictionData[jurisdiction.address]),
                });
                console.log(
                    `${Bright}${FgGreen}Contract at address` +
                    `${jurisdiction.address} has been successfully verified${Reset}`);
                break;
            } catch (error) {
                if (String(error).includes('Already Verified')) {
                    console.log(
                        `${Bright}${FgGreen}Contract at address` +
                        `${jurisdiction.address} has already been verified${Reset}`);
                    break;
                };
                console.log(
                    `${Bright}Retrying verification of contract at address` + 
                    `${jurisdiction.address} - attempt #${++count}, error: ${FgRed}${error}${Reset}`
                );
                if (count === maxTries) 
                    console.log(
                        `${Bright}${FgRed}Failed to verify contract at address` +
                        `${jurisdiction.address} after ${count} attempts, error: ${error}${Reset}`);
                }
            } while (count < maxTries);
        }
    }
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});