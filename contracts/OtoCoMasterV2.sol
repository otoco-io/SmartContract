// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./utils/IOtoCoJurisdiction.sol";
import "./utils/ISeriesURI.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract OtoCoMasterV2 is OwnableUpgradeable, ERC721Upgradeable {

    // Events
    event FeesWithdrawn(address owner, uint256 amount);

    struct Series {
        uint16 jurisdiction;
        uint16 entityType;
        uint64 creation;
        uint64 expiration;
        uint96 reserved;
        string name;
    }

    // Total count of series
    uint256 public seriesCount;
    // Last migrated series at start
    uint256 internal lastMigrated;
    // Mapping from Series Ids to Series data
    mapping(uint256=>Series) public series;

    // Total count of unique jurisdictions
    uint16 public jurisdictionCount;
    // How much series exist in each jurisdiction
    mapping(uint16=>address) public jurisdictionAddress;
    // How much series exist in each jurisdiction
    mapping(uint16=>uint256) public seriesPerJurisdiction;

    // Base External URL to access entities page
    string public externalUrl;

    // The percentage in total gas fees that should be charged in ETH
    uint256 public baseFee;

    mapping(uint256=>uint256) public expiration;
    uint256 public masterFee;
    AggregatorV3Interface internal priceFeed;

    ISeriesURI internal seriesURI;
    address internal marketplaceAddress; 


     /**
     * Check if there's enough ETH paid for public transactions.
     */
    modifier enoughAmountFees() {
        require(msg.value >= (tx.gasprice * gasleft() * baseFee) / 100, "OtoCoMaster: Not enough ETH paid for the execution.");
        _;
    }

     /**
     * Check if there's enough ETH paid for public transactions.
     */
    modifier enoughAmountMasterFees(uint256 _years) {
        (,int256 price,,,) = priceFeed.latestRoundData();
        require(msg.value >= masterFee * uint256(price), "OtoCoMaster: Not enough ETH paid for the execution.");
        _;
    }

    // Upgradeable contract initializer
    function initialize(address[] calldata jurisdictionAddresses, string calldata url) initializer external {
        __Ownable_init();
        __ERC721_init("OtoCo Series", "OTOCO");
        uint16 counter = uint16(jurisdictionAddresses.length);
        for (uint16 i = 0; i < counter; i++){
            jurisdictionAddress[i] = jurisdictionAddresses[i];
        }
        jurisdictionCount = counter;
        baseFee = 10;
        externalUrl = url;
    }

    /**
     * Create a new Series at specific jurisdiction and also select its name.
     *
     * @param jurisdiction Jurisdiction that will store entity.
     * @param controller who will control the entity.
     * @param name the legal name of the entity.
     */
    function createSeries(uint16 jurisdiction, address controller, string memory name) public enoughAmountFees() payable {
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        // Initialize Series data
        series[current] = Series(
            jurisdiction,
            0,
            uint64(block.timestamp),
            0,
            0,
            IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getSeriesNameFormatted(seriesPerJurisdiction[jurisdiction], name)
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
    function closeSeries(uint256 tokenId) public enoughAmountFees() payable {
        require(ownerOf(tokenId) == msg.sender, "OtoCoMaster: Series close from incorrect owner");
        _burn(tokenId);
    }

    receive() enoughAmountFees() external payable {}

    // --- ADMINISTRATION FUNCTIONS ---

    /**
     * Create Masters at specific jurisdiction and also select its name.
     * Could only be called by the administrator of the contract.
     * @dev Trying to use this function on a scenery that more than 500 jurisdiction exists,
     * will require an excessive amount of gas to iterate at the end.
     * We recommend to upgrade the function in these cases.
     *
     * @param jurisdiction new price to be charged for series creation.
     * @param controller the controller of the entity.
     * @param creation the creation timestamp of entity in unix seconds.
     * @param name the legal name of the entity.
     */
    function createBatchMasters(uint16[] calldata jurisdiction, address[] calldata controller, uint64[] calldata creation, string[] calldata name) public onlyOwner {
        require(jurisdiction.length == controller.length, "OtoCoMaster: Owner and Jurisdiction array should have same size.");
        require(name.length == controller.length, "OtoCoMaster: Name and Controller array should have same size.");
        require(controller.length == creation.length, "OtoCoMaster: Controller and Creation array should have same size.");
        require(jurisdiction.length < 256, "OtoCoMaster: Not allowed to migrate more than 255 entities at once.");
        uint8 counter = uint8(controller.length);
        // Uses uint8 cause isn't possible to migrate more than 255 series at once.
        uint8[] memory seriesPerJurisdictionTemp = new uint8[](jurisdictionCount);
        // Iterate through all previous series
        for (uint8 i = 0; i < counter; i++){
            seriesPerJurisdictionTemp[jurisdiction[i]]++;
            series[uint256(i+seriesCount)] = Series(
                jurisdiction[i],
                0,
                creation[i],
                0,
                uint96(block.timestamp + 31536000),
                name[i]
            );
        }
        // Set global storages
        seriesCount = seriesCount+counter;
        for (uint16 i = 0; i < jurisdictionCount; i++){
            if (seriesPerJurisdictionTemp[i] == 0) continue;
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
     * Change creation fees charged for Master entity creation, plugin addition/modification/removal.
     *
     * @param newFee new price to be charged for base fees in USD*1000. to charge 1 USD use 1000.
     */
    function changeBaseMasterFees(uint256 newFee) external onlyOwner{
        masterFee = newFee;
    }

    /**
     * Change creation fees charged for Master entity creation, plugin addition/modification/removal.
     *
     * @param tokenId new price to be charged for base fees in USD*1000. to charge 1 USD use 1000.
     * @param period Period to be extended
     */
    function renewEntity(uint256 tokenId, uint64 period) external onlyOwner{
        // masterFee = newFee;
        Series storage s = series[tokenId];
        s.expiration = period;
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
        if (series[tokenId].entityType == 0){
           return seriesURI.tokenURI(tokenId, lastMigrated, externalUrl);
        }
        return seriesURI.tokenURI(tokenId, lastMigrated, externalUrl);
    }
}