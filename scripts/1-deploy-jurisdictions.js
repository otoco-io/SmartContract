const fs = require('fs');
const { network } = require("hardhat");

async function main() {

    let object = {}

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporated");
    const Delaware = await ethers.getContractFactory("JurisdictionDelaware");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyoming");

    const unincorporated = await Unincorporated.deploy(
        'DAO',
        'https://gateway.pinata.cloud/ipfs/Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/dao_default.png',
        'https://gateway.pinata.cloud/ipfs/Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/dao_gold.png'
    );
    const delaware = await Delaware.deploy(
        'DELAWARE',
        'https://gateway.pinata.cloud/ipfs/Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/de_default.png',
        'https://gateway.pinata.cloud/ipfs/Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/de_gold.png'
    );
    const wyoming = await Wyoming.deploy(
        'WYOMING',
        'https://gateway.pinata.cloud/ipfs/Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/wy_default.png',
        'https://gateway.pinata.cloud/ipfs/Qmf8rDBUz6JzLXRjjxiEiD8cXMuHNCbo4LbcksUVA1wUnR/wy_gold.png'
    );

    const jurisdictions = [unincorporated.address, delaware.address, wyoming.address];

    object.jurisdictions = jurisdictions;
    console.log("🚀 OtoCo Jurisdictions Deployed:", jurisdictions)

    fs.writeFileSync(`./deploys/${network.name}.json`, JSON.stringify(object, undefined, 2));
}
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});