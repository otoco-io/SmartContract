const fs = require('fs');
const { network } = require("hardhat");
const hre = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";
const FgRed = "\x1b[31m";

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
        case "main": badges = badges?.mainData; break;
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
        const deployPrice = 
            (await jurisdiction.callStatic.getJurisdictionDeployPrice()).toString();
        const renewalPrice = 
            (await jurisdiction.callStatic.getJurisdictionRenewalPrice()).toString();
        const defaultBadge = 
            (await jurisdiction.callStatic.getJurisdictionBadge()).toString();
        const goldBadge = 
            (await jurisdiction.callStatic.getJurisdictionGoldBadge()).toString();
        jurisdictionData[jurisdiction.address] = 
            { deployPrice, renewalPrice, defaultBadge, goldBadge };
    }

    console.log(`${Bright}🚀 OtoCo V2 Jurisdictions Deployed:${Reset}`, jurisdictionData);

    fs.writeFileSync(
        `./deploys/v2/${network.name}.json`, 
        JSON.stringify(object, undefined, 2)
    );
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});