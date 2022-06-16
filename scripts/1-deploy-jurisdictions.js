const fs = require('fs');
const { network } = require("hardhat");

async function main() {

    let object = {}

    const Unincorporated = await ethers.getContractFactory("JurisdictionUnincorporated");
    const Delaware = await ethers.getContractFactory("JurisdictionDelaware");
    const Wyoming = await ethers.getContractFactory("JurisdictionWyoming");

    const unincorporated = await Unincorporated.deploy(
        'DAO',
        'https://cloudflare-ipfs.com/ipfs/QmZPXo7N2qDMWaCVezr6Mm7FEmxwDitoWkKC3AjELQqS7N',
        'https://cloudflare-ipfs.com/ipfs/QmWxh2WRenahJ4MKrFLXgN8477drh2xMLYhuWHpJpvAvE4'
    );
    await unincorporated.deployed();
    const delaware = await Delaware.deploy(
        'DELAWARE',
        'https://cloudflare-ipfs.com/ipfs/QmdAkYaMqyycEJ2Rq67zh6Y5x6FW1nBkEBxctL3SvPpkjW',
        'https://cloudflare-ipfs.com/ipfs/QmYxTdUeU8txxdHUVuSTnTjqDFSPdgX5Vd4bcrvK5NByBT'
    );
    await delaware.deployed();
    const wyoming = await Wyoming.deploy(
        'WYOMING',
        'https://cloudflare-ipfs.com/ipfs/QmdbFYPhyyoGF7oZ13f3p8dPG66dzrNyK9483wSaoPooyY',
        'https://cloudflare-ipfs.com/ipfs/QmSayfhjrnAFeVkqAcwYimtcrTZdmyqPKJQDA6HCC6K2x8',
    );
    await wyoming.deployed();

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