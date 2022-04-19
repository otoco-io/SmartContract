// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./utils/IOtoCoJurisdiction.sol";

contract OtoCoMaster is ERC721Upgradeable, OwnableUpgradeable {

    // Events
    event FeesWithdrawn(address owner, uint256 amount);

    struct Series {
        uint16 jurisdiction;
        uint16 entityType;
        uint64 creation;
        string name;
    }

    // Total count of series
    uint256 seriesCount;
    // Last migrated series at start
    uint256 lastMigrated;
    // Mapping from Series Ids to Series data
    mapping(uint256=>Series) public series;

    // Total count of unique jurisdictions
    uint16 public jurisdictionCount;
    // How much series exist in each jurisdiction
    mapping(uint16=>address) public jurisdictionAddress;
    // How much series exist in each jurisdiction
    mapping(uint16=>uint256) public seriesPerJurisdiction;

    // The value to divide the GasLeft * GasPrice
    uint256 public baseFee;

    // Upgradeable contract initializer
    function initialize(address[] calldata jurisdictionAddresses) external {
        __Ownable_init();
        __ERC721_init("OtoCo Series", "OTOCO");
        uint16 counter = uint16(jurisdictionAddresses.length);
        for (uint16 i = 0; i < counter; i++){
            jurisdictionAddress[i] = jurisdictionAddresses[i];
        }
        jurisdictionCount = counter;
        baseFee = 10;
        seriesCount++;
    }

    /**
     * Create a new Series at specific jurisdiction and also select its name.
     *
     * @param jurisdiction Jurisdiction that will store entity.
     * @param controller who will control the entity.
     * @param name the legal name of the entity.
     */
    function createSeries(uint16 jurisdiction, address controller, string memory name) public payable {
        require(msg.value >= tx.gasprice * gasleft() / baseFee, "Not enough ETH paid for the execution.");
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        // Initialize Series data
        series[current] = Series(
            jurisdiction,
            0,
            uint64(block.timestamp),
            IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getSeriesNameFormatted(name)
        );
        // Mint NFT
        _mint(controller, current);
        // Increase counters
        seriesCount++;
        seriesPerJurisdiction[jurisdiction]++;
    }

    /**
     * Close series previously created.
     *
     * @param tokenId of the series to be burned.
     */
    function closeSeries(uint256 tokenId) public payable {
        require(msg.value >= tx.gasprice * gasleft() / baseFee, "Not enough ETH paid for the execution.");
        require(ownerOf(tokenId) == msg.sender, "ERC721: token burn from incorrect owner");
        _burn(tokenId);
    }

    receive() external payable {}

    // --- ADMINISTRATION FUNCTIONS ---

    /**
     * Create a new Series at specific jurisdiction and also select its name.
     * Could only be called by the administrator of the contract.
     *
     * @param jurisdiction new price to be charged for series creation.
     * @param controller the controller of the entity.
     * @param creation the creation timestamp of entity in unix seconds.
     * @param name the legal name of the entity.
     */
    function createBatchSeries(uint16[] calldata jurisdiction, address[] calldata controller, uint64[] calldata creation, string[] calldata name) public onlyOwner {
        require(jurisdiction.length == controller.length, "Master: Owner and Jurisdiction array should have same size.");
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
            // Don't mint closed entities
            if (controller[i] != address(0)){
                _mint(msg.sender, i+seriesCount);
            }
        }
        // Set global storages
        seriesCount = seriesCount+counter;
        lastMigrated = seriesCount;
        for (uint8 i = 0; i < 3; i++){
            seriesPerJurisdiction[i] = seriesPerJurisdiction[i]+seriesPerJurisdictionTemp[i];
        }
    }

    /**
     * Add a new jurisdiction to the contract
     *
     * @param newAddress the address of the jurisdiction.
     */
    function addJurisdiction(address newAddress) external onlyOwner{
        jurisdictionAddress[jurisdictionCount] = newAddress;
        jurisdictionCount++;
    }

    /**
     * Add a new jurisdiction to the contract
     *
     * @param jurisdiction the index of the jurisdiction.
     * @param newAddress the new address of the jurisdiction.
     */
    function updateJurisdiction(uint16 jurisdiction, address newAddress) external onlyOwner{
        jurisdictionAddress[jurisdiction] = newAddress;
    }

    /**
     * Change creation fees charged for entity creation, plugin addition/modification/removal.
     *
     * @param newFee new price to be charged for base fees.
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
        payable(msg.sender).transfer(balance);
        emit FeesWithdrawn(msg.sender, balance);
    }

    // -- TOKEN VISUALS AND DESCRITIVE ELEMENTS --

    /**
     * Get the tokenURI that points to a SVG image.
     * Returns the svg formatted accordingly.
     *
     * @param tokenId must exist.
     * @return svg file formatted.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        Series memory s = series[tokenId];
        IOtoCoJurisdiction jurisdiction = IOtoCoJurisdiction(jurisdictionAddress[s.jurisdiction]);
        string memory badge = jurisdiction.getJurisdictionBadge();
        if (tokenId < lastMigrated) badge = jurisdiction.getJurisdictionGoldBadge();

        string memory details = string(abi.encodePacked(
            "OtoCo Series #",
            tokenId,
            " - ",
            s.name,
            " - ",
            jurisdiction.getJurisdictionName(),
            " - Created at following unix timestamp: ",
            s.creation
        ));
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name": "',
            s.name,
            '", "description": "',
            details,
            '", "image_data": "',
            badge,
            '"}'
        ))));
        return string(abi.encodePacked('data:application/json;base64,', json));
    }
}