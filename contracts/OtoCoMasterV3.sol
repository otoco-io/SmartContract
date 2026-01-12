// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./utils/IOtoCoJurisdiction.sol";
import "./utils/IOtoCoURI.sol";
import "./utils/IOtoCoPlugin.sol";


contract OtoCoMasterV3 is OwnableUpgradeable, ERC721Upgradeable {

    // Custom Errors
    error NotAllowed(); // Thrown when caller is not authorized to perform action
    error InitializerError(); // Thrown when initializer contract call fails
    error IncorrectOwner(); // Thrown when caller is not the token owner
    error InsufficientValue(uint256 available, uint256 required); // Thrown when msg.value is less than required amount
    error InvalidPriceFeed(); // Thrown when price feed address is zero
    error InvalidOraclePrice(); // Thrown when Chainlink oracle returns non-positive price
    error StaleOracleData(); // Thrown when oracle data is older than 2 hours
    error InvalidOracleRound(); // Thrown when oracle round data is incomplete or invalid
    error ReentrancyGuardReentrantCall(); // Thrown when a reentrant call is detected
    error PluginNotAllowed(); // Thrown when a plugin is not in the allowedPlugins list

    // Events
    event FeesWithdrawn(address owner, uint256 amount); // Emitted when contract fees are withdrawn
    event UpdatedPriceFeed(address newPriceFeed); // Emitted when Chainlink price feed address is updated
    event ChangedURISource(address newSource); // Emitted when URI builder contract is changed
    event DocsUpdated(uint256 indexed tokenId); // Emitted when entity documentation is updated
    event NameChanged(uint256 indexed tokenId, string newName); // Emitted when entity name is changed
    event MarketPlaceAddressChanged(address indexed marketplace, bool enabled); // Emitted when a marketplace address is added or removed

    // Series data structure representing a legal entity
    struct Series {
        uint16 jurisdiction; // Index of the jurisdiction where entity is registered
        uint16 entityType; // Type of entity (currently unused in implementation)
        uint64 creation; // Timestamp when entity was created (DEPRECATED)
        uint64 expiration; // Expiration timestamp (currently unused in implementation)
        string name; // Legal name of the entity
    }

    // --- STORAGE VARIABLES (V1) ---

    // Total count of series created
    uint256 public seriesCount;
    // Last migrated series ID from previous contract version
    uint256 internal lastMigrated;
    // Mapping from series ID to Series data
    mapping(uint256=>Series) public series;

    // Total count of registered jurisdictions
    uint16 public jurisdictionCount;
    // Mapping from jurisdiction ID to jurisdiction contract address
    mapping(uint16=>address) public jurisdictionAddress;
    // Mapping from jurisdiction ID to count of series in that jurisdiction
    mapping(uint16=>uint256) public seriesPerJurisdiction;

    // Base external URL for accessing entity pages
    string public externalUrl;

    // Base fee multiplier for gas-based pricing (multiplied by gasleft())
    uint256 public baseFee;

    // --- STORAGE VARIABLES (V3) ---

    // Constant for ETH price feed conversion (1 ETH * 10^8 to match Chainlink decimals)
    uint256 constant priceFeedEth = 1 ether * (10**8);
    // Chainlink price feed interface for ETH/USD conversion
    AggregatorV3Interface internal priceFeed;
    // URI builder contract for generating token metadata
    IOtoCoURI public entitiesURI;
    // Mapping of addresses authorized to create entities without payment
    mapping(address=>bool) public marketplaceAddress;
    // Mapping of plugin addresses authorized for use
    mapping(address=>bool) internal allowedPlugins;
    // Mapping from token ID to documentation URL or IPFS hash
    mapping(uint256=>string) public docs;
    // Address where withdrawn fees are sent
    address public withdrawalAddress;
    
    // Reentrancy guard state variable
    uint256 private _locked;

    /**
     * @dev Restricts function access to contract owner or authorized marketplace addresses.
     * Reverts with NotAllowed if caller is neither owner nor marketplace.
     */
    modifier onlyOwnerOrMarketplace() {
        if (msg.sender != owner() && !marketplaceAddress[msg.sender]) {
            revert NotAllowed();
        }
        _;
    }

    /**
     * @dev Prevents reentrancy attacks by ensuring function is not called recursively.
     * Sets lock before function execution and releases it after.
     */
    modifier nonReentrant() {
        if (_locked != 0) revert ReentrancyGuardReentrantCall();
        _locked = 1;
        _;
        _locked = 0;
    }

    /**
     * @dev Validates that sufficient ETH is provided for USD-priced operations.
     * Converts USD price to ETH using Chainlink oracle and checks msg.value.
     * Owner and marketplace addresses bypass this check.
     * 
     * @param usdPrice The price in USD (with appropriate decimals) to validate payment for.
     */
    modifier enoughAmountUSD(uint256 usdPrice) {
        if (msg.sender != owner() && !marketplaceAddress[msg.sender]) {
            uint256 requiredValue= priceConverter(usdPrice);
            if (msg.value < requiredValue) revert InsufficientValue({
                available: msg.value,
                required: requiredValue
            });
        }
        _;
    }

    /**
     * @dev Converts USD price to ETH amount using Chainlink price feed.
     * Includes multiple validation checks to ensure oracle data integrity:
     * - Validates price feed is configured
     * - Ensures price is positive
     * - Checks data freshness (max 2 hours old)
     * - Validates round completion
     *
     * @param usdPrice The USD amount to convert to ETH.
     * @return The equivalent ETH amount required.
     */
    function priceConverter(uint256 usdPrice) public view returns (uint256) {
        // Validate price feed address is not null
        if (address(priceFeed) == address(0)) revert InvalidPriceFeed();
        
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        // Validate price is positive
        if (price <= 0) revert InvalidOraclePrice();
        
        // Validate staleness - data should be recent
        if (block.timestamp - updatedAt > 2 hours) revert StaleOracleData();
        
        // Validate round is complete and valid
        if (answeredInRound < roundId) revert InvalidOracleRound();
        if (updatedAt == 0) revert InvalidOracleRound();
        
        return (priceFeedEth/uint256(price))*usdPrice;
    }

    /**
     * @dev Initializes the upgradeable contract with jurisdictions and configuration.
     * Sets up ERC721 with name "OtoCo Series" and symbol "OTOCO".
     * Initializes baseFee to 10 for gas-based pricing.
     * Can only be called once due to initializer modifier.
     *
     * @param jurisdictionAddresses Array of pre-deployed jurisdiction contract addresses.
     * @param url Base external URL for entity pages.
     */
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
     * @dev Creates a new legal entity series as an ERC721 token.
     * Validates that jurisdiction supports non-standalone entities.
     * Requires payment in ETH equivalent to jurisdiction's deploy price (unless caller is owner/marketplace).
     * Mints an NFT to the controller address and increments counters.
     *
     * @param jurisdiction The jurisdiction ID where the entity will be registered.
     * @param controller The address that will own the entity NFT.
     * @param name The legal name of the entity (will be formatted by jurisdiction).
     */
    function createSeries(uint16 jurisdiction, address controller, string memory name) 
    public enoughAmountUSD(
        IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getJurisdictionDeployPrice()
    ) payable {
        if (IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).isStandalone() == true) {
            revert NotAllowed();
        }

        // Get current series count to use as token ID
        uint256 current = seriesCount;
        // Create Series struct with jurisdiction data and formatted name
        series[current] = Series(
            jurisdiction,
            0,
            uint64(block.timestamp),
            0,
            IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getSeriesNameFormatted(seriesPerJurisdiction[jurisdiction], name)
        );
        // Mint ERC721 token to controller
        _mint(controller, current);
        // Increment total series counter and jurisdiction-specific counter
        seriesCount++;
        seriesPerJurisdiction[jurisdiction]++;
    }

    /**
     * @dev Creates a new entity with initializer contract and optional plugins.
     * First plugin (index 0) is treated as initializer, which determines the entity controller.
     * Subsequent plugins (index 1+) are added after entity creation.
     * Payment required includes: gas estimate (gasleft() * baseFee) + jurisdiction price + initializer value.
     * Owner and marketplace addresses bypass payment requirements.
     *
     * @param jurisdiction The jurisdiction ID where the entity will be registered.
     * @param plugins Array of plugin contract addresses. Index 0 is initializer (can be address(0) to skip).
     * @param pluginsData Array of encoded data for each plugin call. Index 0 is for initializer.
     * @param value Amount of ETH to send to the initializer contract.
     * @param name The legal name of the entity.
     */
    function createEntityWithInitializer(
        uint16 jurisdiction,
        address[] calldata plugins,
        bytes[] calldata pluginsData,
        uint256 value,
        string calldata name
    ) public payable nonReentrant {
        if (IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).isStandalone() == true) {
            revert NotAllowed();
        }
        // Validate payment covers gas estimate, jurisdiction fee, and initializer value
        // Owner and marketplace addresses can override payment requirements
        if (msg.sender != owner() && !marketplaceAddress[msg.sender]) {
            uint256 valueRequired = gasleft()*baseFee
                + priceConverter(IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getJurisdictionDeployPrice())
                + value;
            if (msg.value < valueRequired) revert InsufficientValue({
                available: msg.value,
                required: valueRequired
            });
        }
        // Default controller is msg.sender
        address controller = msg.sender;
        // If initializer is provided, call it and extract controller address from return data
        if (plugins[0] != address(0x0)) {
            (bool success, bytes memory initializerBytes) = plugins[0].call{value: value}(pluginsData[0]);
            if (!success || plugins[0].code.length == 0) revert InitializerError();
            assembly {
                controller := mload(add(initializerBytes,32))
            }
        }
        // Store current series count for plugin calls
        uint256 current = seriesCount;
        // Create the entity series with determined controller
        createSeries(jurisdiction, controller, name);
        // Add remaining plugins (starting from index 1) to the newly created entity
        for (uint8 i=1; i<plugins.length; i++){
            if (!allowedPlugins[plugins[i]]) revert PluginNotAllowed();
            IOtoCoPlugin(plugins[i]).addPlugin(current, pluginsData[i]);
        }
    }

    /**
     * @dev Updates the legal name of an existing entity.
     * Restricted to owner or marketplace addresses only.
     *
     * @param tokenId The ID of the entity to update.
     * @param newName The new legal name for the entity.
     */
    function updateEntityName(uint256 tokenId, string memory newName) external onlyOwnerOrMarketplace {
        series[tokenId].name = newName;
        emit NameChanged(tokenId, newName);
    }

    /**
     * @dev Closes an entity by burning its NFT.
     * Requires payment in ETH equivalent to jurisdiction's close price (unless caller is owner/marketplace).
     * Only the entity owner can close their entity.
     *
     * @param tokenId The ID of the entity to close.
     */
    function closeSeries(uint256 tokenId) public enoughAmountUSD(
        IOtoCoJurisdiction(jurisdictionAddress[series[tokenId].jurisdiction]).getJurisdictionClosePrice()
    ) payable {
        if(ownerOf(tokenId) != msg.sender) revert IncorrectOwner();
        _burn(tokenId);
    }

    /**
     * @dev Sets or updates documentation reference for an entity.
     * Only the entity owner can update documentation.
     * Emits DocsUpdated event.
     *
     * @param tokenId The ID of the entity.
     * @param documentation The documentation URL or IPFS hash.
     */
    function setDocs(uint256 tokenId, string memory documentation) external {
        if(ownerOf(tokenId) != msg.sender) revert IncorrectOwner();
        docs[tokenId] = documentation;

        emit DocsUpdated(tokenId);
    }

    /**
     * @dev Fallback function to accept ETH payments.
     */
    receive() external payable {}

    // --- ADMINISTRATION FUNCTIONS ---

    /**
     * @dev Adds a new jurisdiction contract to the system.
     * Increments jurisdiction count and assigns the address.
     * Only callable by contract owner.
     *
     * @param newAddress The address of the new jurisdiction contract.
     */
    function addJurisdiction(address newAddress) external onlyOwner {
        jurisdictionAddress[jurisdictionCount] = newAddress;
        jurisdictionCount++;
    } 

    /**
     * @dev Updates an existing jurisdiction contract address.
     * Allows replacing jurisdiction implementations without affecting existing entities.
     * Only callable by contract owner.
     *
     * @param jurisdiction The index of the jurisdiction to update.
     * @param newAddress The new address for the jurisdiction contract.
     */
    function updateJurisdiction(uint16 jurisdiction, address newAddress) external onlyOwner {
        jurisdictionAddress[jurisdiction] = newAddress;
    }

    /**
     * @dev Configures marketplace addresses and their authorization status.
     * Marketplace addresses can create entities without payment and perform privileged operations.
     * Supports batch updates for multiple addresses.
     * Only callable by contract owner.
     *
     * @param addresses Array of marketplace addresses to configure.
     * @param enabled Array of boolean flags indicating whether each address should be enabled.
     */
    function setMarketplaceAddresses(address[] calldata addresses, bool[] calldata enabled) external onlyOwner {
        uint256 i;
        uint256 addressesSize = addresses.length;  
        for (i; i < addressesSize;){
            marketplaceAddress[addresses[i]] = enabled[i];
            emit MarketPlaceAddressChanged(addresses[i], enabled[i]);
            unchecked { ++i; }
        }
    }

    /**
     * @dev Configures allowed plugin addresses and their authorization status.
     * Only whitelisted plugins can be used in createEntityWithInitializer.
     * Supports batch updates for multiple addresses.
     * Only callable by contract owner.
     *
     * @param addresses Array of plugin addresses to configure.
     * @param enabled Array of boolean flags indicating whether each plugin should be allowed.
     */
    function setAllowedPlugins(address[] calldata addresses, bool[] calldata enabled) external onlyOwnerOrMarketplace {
        uint256 i;
        uint256 addressesSize = addresses.length;  
        for (i; i < addressesSize;){
            allowedPlugins[addresses[i]] = enabled[i];
            unchecked { ++i; }
        }
    }

    /**
     * @dev Updates the URI builder contract used for generating token metadata.
     * Emits ChangedURISource event.
     * Only callable by contract owner.
     *
     * @param newEntitiesURI Address of the new URI builder contract.
     */
    function changeURISources(address newEntitiesURI) external onlyOwner {
        entitiesURI = IOtoCoURI(newEntitiesURI);
        emit ChangedURISource(newEntitiesURI);
    }

    /**
     * @dev Updates the Chainlink price feed address used for ETH/USD conversion.
     * Emits UpdatedPriceFeed event.
     * Callable by owner or marketplace addresses.
     *
     * @param newPriceFeed Address of the new Chainlink price feed contract.
     */
    function changePriceFeed(address newPriceFeed) external onlyOwnerOrMarketplace {
        priceFeed = AggregatorV3Interface(newPriceFeed);
        emit UpdatedPriceFeed(newPriceFeed);
    }

    /**
     * @dev Updates the address where withdrawn fees are sent.
     * Only callable by contract owner.
     *
     * @param newWithdrawalAddress The new withdrawal destination address.
     */
    function changeWithdrawalAddress(address newWithdrawalAddress) external onlyOwner {
        withdrawalAddress = newWithdrawalAddress;
    }

    /**
     * @dev Withdraws entire contract balance to the configured withdrawal address.
     * Requires withdrawalAddress to be set (non-zero).
     * Emits FeesWithdrawn event.
     * Callable by owner or marketplace addresses.
     */
    function withdrawFees() external onlyOwnerOrMarketplace {
        if (withdrawalAddress == address(0)) revert NotAllowed();
        uint256 balance = address(this).balance;
        (bool success, ) = payable(withdrawalAddress).call{value: balance}("");
        if (!success) revert NotAllowed();
        emit FeesWithdrawn(withdrawalAddress, balance);
    }

    // --- TOKEN METADATA ---

    /**
     * @dev Returns the token URI for an entity's metadata.
     * Delegates to the configured entitiesURI contract for URI generation.
     * Overrides ERC721 tokenURI function.
     *
     * @param tokenId The ID of the entity token.
     * @return The complete token URI string with metadata.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return entitiesURI.tokenExternalURI(tokenId, lastMigrated);
    }
}