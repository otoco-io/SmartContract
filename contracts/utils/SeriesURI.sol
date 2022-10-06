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
    string private externalUrl;
    uint256 lastMigrated;


    constructor (address payable masterAddress, uint256 _lastMigrated, string memory _externalUrl) {
        otocoMaster = IOtoCoMasterV2(masterAddress);
        externalUrl = _externalUrl;
        lastMigrated = _lastMigrated;
    }

    // -- TOKEN VISUALS AND DESCRIPTIVE ELEMENTS --

    /**
     * Get the tokenURI that points to a SVG image.
     * Returns the svg formatted accordingly.
     *
     * @param tokenId must exist.
     * @return svg file formatted.
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        IOtoCoMasterV2.Series memory s = otocoMaster.series(tokenId);
        IOtoCoJurisdiction jurisdiction = IOtoCoJurisdiction(otocoMaster.jurisdictionAddress(s.jurisdiction));
        string memory badge = jurisdiction.getJurisdictionBadge();
        if (tokenId < lastMigrated) badge = jurisdiction.getJurisdictionGoldBadge();

        string memory details = string(abi.encodePacked(
            "OtoCo NFTs are minted to represent each entity and their jurisdiction as created by the OtoCo dapp. ",
            "The holder of this NFT as recorded on the blockchain is the owner of ",
            s.name,
            " and is authorized to access the entity's dashboard on https://otoco.io."
        ));
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name": "',
            s.name,
            '", "description": "',
            details,
            '", "image": "',
            badge,
            '", "external_url": "',
            externalUrl,
            tokenId.toString(),
            '/","attributes":[',
            '{"display_type": "date","trait_type": "Creation", "value": "',
            uint256(s.creation).toString(),
            '"},{"trait_type": "Jurisdiction", "value": "',
            jurisdiction.getJurisdictionName(),
            '"}]}'
        ))));
        return string(abi.encodePacked('data:application/json;base64,', json));
    }
}