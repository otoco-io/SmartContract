// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

import "./IOtoCoMasterV2.sol";
import "./IOtoCoJurisdiction.sol";

contract SeriesURI {

    // Libraries
    using Strings for uint256;

    IOtoCoMasterV2 private otocoMaster;

    constructor (address payable masterAddress) {
        otocoMaster = IOtoCoMasterV2(masterAddress);
    }

    // -- TOKEN VISUALS AND DESCRIPTIVE ELEMENTS --

    /**
     * Get the tokenURI that points to a SVG image.
     * Returns the svg formatted accordingly.
     *
     * @param tokenId must exist.
     * @return svg file formatted.
     */
    function tokenExternalURI(uint256 tokenId, uint256 lastMigrated) external view returns (string memory) {
        (uint16 jurisdiction,,uint64 creation,,string memory name) = otocoMaster.series(tokenId);
        IOtoCoJurisdiction jurisdictionContract = IOtoCoJurisdiction(otocoMaster.jurisdictionAddress(jurisdiction));
        string memory badge = jurisdictionContract.getJurisdictionBadge();
        if (tokenId < lastMigrated) badge = jurisdictionContract.getJurisdictionGoldBadge();

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name": "',
            name,
            '", "description": "',
            "OtoCo NFTs are minted to represent each entity and their jurisdiction as created by the OtoCo dapp. ",
            "The holder of this NFT as recorded on the blockchain is the owner of ",
            name,
            " and is authorized to access the entity's dashboard on https://otoco.io.",
            '", "image": "',
            badge,
            '", "external_url": "',
            otocoMaster.externalUrl(),
            tokenId.toString(),
            '/","attributes":[',
            '{"display_type": "date","trait_type": "Creation", "value": "',
            uint256(creation).toString(),
            '"},{"trait_type": "Jurisdiction", "value": "',
            jurisdictionContract.getJurisdictionName(),
            '"}]}'
        ))));
        return string(abi.encodePacked('data:application/json;base64,', json));
    }
}