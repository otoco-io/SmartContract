// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract OtoCoMaster is OwnableUpgradeable, ERC721 {

    // Libraries
    using Strings for uint256;

    // Events
    event FeesWithdrawn(address owner, uint256 amount);

    struct Series {
        uint16 jurisdiction;
        uint16 entityType;
        uint64 creation;
        string entityName;
    }

    // Total count of series
    uint256 seriesCount;
    // Series mapping from ids to structs
    mapping(uint256=>Series) public series;
    // Series mapping from ids to structs
    mapping(uint256=>string) public agreements;
    // Series count for each jurisdiction
    mapping(uint16=>uint256) public seriesPerJurisdiction;
    // Fees spin-up cost
    uint256 public baseFee;
    // Jurisdiction count
    uint16 public jurisdictionCount;
    // Jurisdiction names
    mapping(uint16=>string) public jurisdictionNames;
    // Jurisdiction PDF agreement URI
    mapping(uint16=>string) public jurisdictionAgreement;

    // Upgradeable contract initializer
    function initialize(string[] _jurisdictionNames) external {
        __Ownable_init();
        uint256 counter = _jurisdictionNames.length;
        for (uint i = 0; i < counter; i++){
            jurisdictionNames[i] = _jurisdictionNames[i];
        }
        seriesCount++;
    }

    /**
     * Create a new Series at specific jurisdiction and also select its name.
     * Could only be called by the administrator of the contract.
     *
     * @param jurisdiction new price to be charged for series creation.
     * @param controller the controller of the entity.
     * @param name the legal name of the entity.
     */
    function createBatchSeries(uint8[] jurisdiction, address[] controller, string[] memory name) public onlyOwner {
        require(jurisdiction.length == owner.length, "Master: Owner and Jurisdiction array should have same size.");
        require(name.length == controller.length, "Master: Owner and Name array should have same size.");
        uint32 counter = uint32(controller.length);
        uint32[] memory seriesPerJurisdictionTemp = new uint32[](3);
        // Iterate through all previous series
        for (uint32 i = 0; i < counter; i++){
            seriesPerJurisdictionTemp[jurisdiction[i]]++;
            series[uint32(i+seriesCount)] = Series(
                jurisdiction[i],
                0,
                creation[i],
                name[i]
            );
            if (controller[i] != address(0)){
                _mint(msg.sender, current);
            }
        }
        // Set global storages
        seriesCount = seriesCount+counter;
        for (uint8 i = 0; i <= 2; i++){
            seriesPerJurisdiction[i] = seriesPerJurisdiction[i]+seriesPerJurisdictionTemp[i];
        }
    }

    /**
     * Create a new Series at specific jurisdiction and also select its name.
     *
     * @param jurisdiction new price to be charged for series creation.
     * @param name the legal name of the entity.
     */
    function createSeries(Jurisdiction jurisdiction, string memory name) public payable {
        require(msg.value >= tx.gas * gasLeft * 0.1, "Not enough ETH paid for the transaction.");
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        // Initialize Series data
        series[current] = Series(
            jurisdiction,
            0,
            block.timestamp,
            getJurisdictionNameFormatted(name)
        );
        // Mint NFT
        _mint(msg.sender, current);
        // Increase counters
        seriesCount++;
        seriesPerJurisdiction[jurisdiction]++;
    }

    /**
     * Close series previously created.
     *
     * @param tokenId of the series to be burned.
     */
    function closeSeries(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "ERC721: token burn from incorrect owner");
        _burn(tokenId);
    }

    // --- ADMINISTRATION FUNCTIONS ---

    /**
     * Add a new jurisdiction to the contract
     *
     * @param jurisdictionName the name of the jurisdiction to be added.
     */
    function addNewJurisdiction(string jurisdictionName) external onlyOwner{
        jurisdictionNames[jurisdictionCount] = jurisdictionName;
        jurisdictionCount++;
    }

    /**
     * Change creation fees charged for entity creation, plugin addition/modification.
     *
     * @param newFee new price to be charged for series creation.
     * @param jurisdictions jurisdictions to have price updated.
     */
    function changeBaseFees(uint256 newFee) external onlyOwner{
        baseFee = newFee;
    }

    /**
     * Withdraw fees paid by series creation.
     * Fees are transfered to the caller of the function that should be the contract owner.
     *
     * Emits a {FeesWithdraw} event.
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        address(msg.sender).transfer(balance);
        emit FeesWithdrawn(msg.sender, balance);
    }

    // -- TOKEN VISUALS AND DESCRITIVE ELEMENTS --

    /**
     * Get formatted name according to the jurisdiction requirement.
     * To use when create new series, before series creation.
     * Returns the string name formatted accordingly.
     *
     * @param name as string.
     * @return name formatted according to the jurisdiction
     */
    function getSeriesNameFormatted(string memory name) internal view returns (string memory) {
        if (Jurisdictions.DAO == j) return name;
        if (Jurisdictions.DELAWARE == j) return string(abi.encodePacked(name, ' LLC'));
        if (Jurisdictions.WYOMING == j)
            return string(abi.encodePacked(name, ' - Series ', uint256(seriesPerJurisdiction[Jurisdictions.WYOMING]).toString()));
    }

    /**
     * Get jurisdiction name as a string.
     * To use when fetch entity SVG.
     * Returns the string jurisdiction name formatted accordingly.
     *
     * @param jurisdiction must exist.
     * @param string jurisdiction name formatted
     */
    function getJurisdictionAsString(Jurisdictions jurisdiction) internal view returns (string memory){
        if (Jurisdictions.DAO == j) return "DAO";
        if (Jurisdictions.DELAWARE == j) return "DELAWARE";
        if (Jurisdictions.WYOMING == j) return "WYOMING";
    }

    /**
     * Get SVG formatted string. To be used inside tokenUri function.
     * Returns the svg formatted accordingly.
     *
     * @param tokenId must exist.
     * @return json tags formatted
     */
    function getSvg(uint tokenId) private view returns (string memory) {
        string[3] memory parts;
        parts[0] = "<svg viewBox='0 0 350 350'><style>.a { fill: #0000; font-size: 18px; }</style><text x='10' y='10' class='a'>Token #";
        parts[1] = string(tokenId);
        parts[2] = "</text></svg>";

        return string(abi.encodePacked, parts[0], parts[1], parts[2]);
    }

    /**
     * Get the tokenURI that points to a SVG image.
     * Returns the svg formatted accordingly.
     *
     * @param `tokenId` must exist.
     * @return svg file formatted.
     */
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        string memory svgData = getSvg(tokenId);
        Series memory s = series[tokenId];
        string memory details = string(abi.encodePacked, s.name, " - ", getJurisdictionAsString(s.jurisdiction));
        string memory json = Base64.encode(bytes(string(
            abi.encodePacked('{"name": "OtoCo Series", "description": "', bytes(details) ,'", "image_data": "', bytes(svgData), '"}')
        )));
        return string(abi.encodePacked('data:application/json;base64,', json));
    }
}