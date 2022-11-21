// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./utils/IOtoCoJurisdiction.sol";
import "./utils/ISeriesURI.sol";
import "./utils/IOtoCoPlugin.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract OtoCoMasterV2 is OwnableUpgradeable, ERC721Upgradeable {

    // Events
    event FeesWithdrawn(address owner, uint256 amount);

    struct Series {
        uint16 jurisdiction;
        uint16 entityType;
        uint64 creation;
        uint64 expiration;
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
    // The price to renew entities
    uint256 public renewFee;
    AggregatorV3Interface internal priceFeed;

    ISeriesURI public seriesURI;
    mapping(address=>bool) internal marketplaceAddress;

    /**
     * Check if there's enough ETH paid for public transactions.
     */
    modifier onlyMarketplace() {
        require(marketplaceAddress[msg.sender], "OtoCoMaster: Not a marketplace address.");
        _;
    }

     /**
     * Check if there's enough ETH paid for public transactions.
     */
    modifier enoughAmountFees() {
        require(msg.value >= gasleft() * baseFee, "OtoCoMaster: Not enough ETH paid for the execution.");
        _;
    }

     /**
     * Check if there's enough ETH paid for USD priced transactions.
     */
    modifier enoughAmountUSD(uint256 usdPrice) {
        (,int256 conversion,,,) = priceFeed.latestRoundData();
        require(msg.value >= usdPrice * uint256(conversion), "OtoCoMaster: Not enough ETH paid for the execution.");
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
            IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getSeriesNameFormatted(seriesPerJurisdiction[jurisdiction], name)
        );
        // Mint NFT
        _mint(controller, current);
        // Increase counters
        seriesCount++;
        seriesPerJurisdiction[jurisdiction]++;
    }

    function createEntityWithInitializer(
        uint16 jurisdiction,
        address[] calldata plugins,
        bytes[] calldata pluginsData,
        uint256[] calldata values,
        string calldata name
    ) public enoughAmountFees() payable {
        address controller = msg.sender;
        (bool success, bytes memory controllerBytes) = plugins[0].call{value: values[0]}(pluginsData[0]);
        require(success, 'OtoCoMaster: Initializer errored');
        assembly {
            controller := mload(add(controllerBytes,20))
        }
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        createSeries(jurisdiction, controller, name);
        for (uint8 i=1; i<plugins.length; i++){
            IOtoCoPlugin(plugins[i]).addPlugin(current, pluginsData[i]);
        }
    }

    function createEntityWithoutInitializer(
        uint16 jurisdiction,
        address[] calldata plugins,
        bytes[] calldata pluginsData,
        address controller,
        string calldata name
    ) public enoughAmountFees() payable {
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        createSeries(jurisdiction, controller, name);
        for (uint8 i=0; i<plugins.length; i++){
            IOtoCoPlugin(plugins[i]).addPlugin(current, pluginsData[i]);
        }
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
     * replace Marketplace Address to the contract
     *
     * @param newAddress the address of the jurisdiction.
     */
    function setMarketplaceAddress(address newAddress, bool enabled) external onlyOwner{
        marketplaceAddress[newAddress] = enabled;
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
    function changeBaseFees(uint256 newFee) external onlyOwner {
        baseFee = newFee;
    }

    /**
     * Replace URI builder contract
     *
     * @param newSeriesURI New URI builder contract
     */
    function changeURISources(address newSeriesURI) external onlyOwner {
        seriesURI = ISeriesURI(newSeriesURI);
    }

    /**
     * Create a new entity to a specific jurisdiction. 
     *
     * @param jurisdiction The jurisdiction for the created entity.
     * @param expiration expiration of the entity, date limit to renew.
     * @param name name of the entity.
     */
    function addEntity(
        uint16 jurisdiction,
        uint64 expiration,
        string calldata name
    ) external onlyMarketplace {
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        // Initialize Series data
        series[current] = Series(
            jurisdiction,
            1,                          // Standalone entity type
            uint64(block.timestamp),
            expiration,
            name
        );
        // Mint NFT
        _mint(msg.sender, current);
        // Increase counters
        seriesCount++;
        seriesPerJurisdiction[jurisdiction]++;
    }

    /**
     * Change creation fees charged for Master entity creation, plugin addition/modification/removal.
     *
     * @param tokenId new price to be charged for base fees in USD*1000. to charge 1 USD use 1000.
     * @param period Period to be extended
     */
    function renewEntity(uint256 tokenId, uint64 period) external {
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

    // -- TOKEN VISUALS AND DESCRIPTIVE ELEMENTS --

    /**
     * Get the tokenURI that points to a SVG image.
     * Returns the svg formatted accordingly.
     *
     * @param tokenId must exist.
     * @return svg file formatted.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // if (series[tokenId].entityType == 0){
        //    return seriesURI.tokenURI(tokenId, lastMigrated);
        // }
        return seriesURI.tokenExternalURI(tokenId, lastMigrated);
    }
}