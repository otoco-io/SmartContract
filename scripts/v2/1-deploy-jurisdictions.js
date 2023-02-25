const fs = require('fs');
const { network } = require("hardhat");

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";

async function main() {

    let object = {}

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporatedV2");
    const Delaware = await ethers.getContractFactory("JurisdictionDelawareV2");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyomingV2");
    
    const uncPrice = [0,2]; 
    const dePrice = [5,5];
    const wyPrice = [50, 40];

    let unincorporated, delaware, wyoming

    if (network.name == 'main'){
        unincorporated = await Unincorporated.deploy(
            ...uncPrice,  
            'DAO',
            'ipfs://QmZPXo7N2qDMWaCVezr6Mm7FEmxwDitoWkKC3AjELQqS7N',
            'ipfs://QmWxh2WRenahJ4MKrFLXgN8477drh2xMLYhuWHpJpvAvE4'
        );
        await unincorporated.deployed();
        delaware = await Delaware.deploy(
            ...dePrice,
            'DELAWARE',
            'ipfs://QmdAkYaMqyycEJ2Rq67zh6Y5x6FW1nBkEBxctL3SvPpkjW',
            'ipfs://QmYxTdUeU8txxdHUVuSTnTjqDFSPdgX5Vd4bcrvK5NByBT'
        );
        await delaware.deployed();
        wyoming = await Wyoming.deploy(
            ...wyPrice,
            'WYOMING',
            'ipfs://QmdbFYPhyyoGF7oZ13f3p8dPG66dzrNyK9483wSaoPooyY',
            'ipfs://QmSayfhjrnAFeVkqAcwYimtcrTZdmyqPKJQDA6HCC6K2x8',
        );
        await wyoming.deployed();
    }

    if (network.name == 'polygon'){
        unincorporated = await Unincorporated.deploy(
            ...uncPrice, 
            'DAO',
            'ipfs://QmcCeDkQJyYA6JsrnXSLRFW3Wq9FyrVSvmdntJfnu4gjR7',
            'ipfs://Qme1MfHkTRF1ZGmCjL21JJyQm2gbBbxDHzghM4euEuNpDZ',
        );
        await unincorporated.deployed();
        delaware = await Delaware.deploy(
            ...dePrice,
            'DELAWARE',
            'ipfs://QmbKJ9PibuMM1RWarUPj3L5TViaRJJazafWKdQkN279LNs',
            'ipfs://QmPrfVvhMxsNWVd6UpmxLCNEuSWeUBnW65RuHnuMA1jjPa'
        );
        await delaware.deployed();
        wyoming = await Wyoming.deploy(
            ...wyPrice,
            'WYOMING',
            'ipfs://QmSZq2bELrttCWcnHNZP16iwNEF2GxS6jgzpjR8AFJCoSw',
            'ipfs://QmUR3nGosdHbavY3aSvsAsxvJLyVcVJxDL9Xh8bv851r8Q',
        );
        await wyoming.deployed();
    }

    // Case for testnets
    if (network.name != 'polygon' && network.name != 'main'){
        unincorporated = await Unincorporated.deploy(
            ...uncPrice, 
            'DAO',
            'ipfs://Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/dao_default.png',
            'ipfs://Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/dao_gold.png'
        );
        await unincorporated.deployed();
        delaware = await Delaware.deploy(
            ...dePrice,
            'DELAWARE',
            'ipfs://Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/de_default.png',
            'ipfs://Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/de_gold.png'
        );
        await delaware.deployed();
        wyoming = await Wyoming.deploy(
            ...wyPrice,
            'WYOMING',
            'ipfs://Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/wy_default.png',
            'ipfs://Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/wy_gold.png'
        );
        await wyoming.deployed();
    }

    const jurisdictions = [unincorporated, delaware, wyoming];

    object.jurisdictions = jurisdictions.map(({ address }) => address);

    const [deployer] = await ethers.getSigners();
    console.log(`${Bright}👤 Contract deployed with ${deployer.address}${Reset}`, "\n");
    
    const prices = {};
    
    for (const jurisdiction of jurisdictions) {
        const deployPrice = (await jurisdiction.callStatic.getJurisdictionDeployPrice()).toString();
        const renewalPrice = (await jurisdiction.callStatic.getJurisdictionRenewalPrice()).toString();
        prices[jurisdiction.address] = { deployPrice, renewalPrice };
    }

    console.log(`${Bright}🚀 OtoCo V2 Jurisdictions Deployed:${Reset}`, prices);

    fs.writeFileSync(`./deploys/v2/${network.name}.json`, JSON.stringify(object, undefined, 2));
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});