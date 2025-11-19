// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./utils/IOtoCoJurisdiction.sol";
import "./utils/IOtoCoURI.sol";
import "./utils/IOtoCoPlugin.sol";


contract OtoCoMasterV2 is OwnableUpgradeable, ERC721Upgradeable, ReentrancyGuardUpgradeable {

    // Custom Errors
    error NotAllowed();
    error InitializerError();
    error IncorrectOwner();
    error InsufficientValue(uint256 available, uint256 required);

    // Events
    event FeesWithdrawn(address owner, uint256 amount);
    event UpdatedPriceFeed(address newPriceFeed);
    event BaseFeeChanged(uint256 newFee);
    event ChangedURISource(address newSource);
    event DocsUpdated(uint256 indexed tokenId);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event WithdrawalWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event JurisdictionAdded(uint16 indexed jurisdictionId, address indexed jurisdictionAddress);
    event JurisdictionUpdated(uint16 indexed jurisdictionId, address indexed oldAddress, address indexed newAddress);
    event EntityNameUpdated(uint256 indexed tokenId, string newName, address indexed updatedBy);

    // Series Structs
    struct Series {
        uint16 jurisdiction;
        uint16 entityType;
        uint64 creation;
        uint64 expiration;
        string name;
    }

    // OLD STORAGE VARIABLES

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

    // NEW STORAGE VARIABLES 

    // Constant ETH to divide by price
    uint256 constant priceFeedEth = 1 ether * (10**8);
    // Chainlink price feed reference
    AggregatorV3Interface internal priceFeed;
    // Default URI builder for OtoCo Entities
    IOtoCoURI public entitiesURI;
    // Valid marketplace addresses that are allowed to create standalone entities
    mapping(address=>bool) internal marketplaceAddress;
    mapping(address=>bool) internal allowedPlugins;
    mapping(uint256=>string) public docs;
    
    // ADMIN AND WITHDRAWAL STORAGE VARIABLES
    
    // Array of admin wallets that can perform owner functions and create entities for free
    address[] public adminWallets;
    // Mapping for quick admin lookup
    mapping(address=>bool) public isAdmin;
    // Withdrawal wallet where fees are sent
    address public withdrawalWallet;
    
    // Reserve storage space for future variables in upgradeable contracts
    uint256[50] private __gap;
    
    /**
     * Check if the sender is owner or admin
     */
    modifier onlyOwnerOrAdmin() {
        if (msg.sender != owner() && !isAdmin[msg.sender]) revert NotAllowed();
        _;
    }

    /**
     * Check if there's enough ETH paid for public transactions.
     */
    modifier onlyMarketplace() {
        if (!marketplaceAddress[msg.sender]) revert NotAllowed();
        _;
    }

     /**
     * Check if there's enough ETH paid for public transactions.
     * Admin wallets can skip this fee.
     */
    modifier enoughAmountFees() {
        if (!isAdmin[msg.sender]) {
            if (msg.value < gasleft() * baseFee) revert InsufficientValue({
                available: msg.value,
                required: gasleft() * baseFee
            });
        }
        _;
    }

     /**
     * Check if there's enough ETH paid for USD priced transactions.
     * Admin wallets can skip this fee.
     */
    modifier enoughAmountUSD(uint256 usdPrice) {
        if (!isAdmin[msg.sender]) {
            uint256 requiredValue= priceConverter(usdPrice);
            if (msg.value < requiredValue) revert InsufficientValue({
                available: msg.value,
                required: requiredValue
            });
        }
        _;
    }

    function priceConverter(uint256 usdPrice) public view returns (uint256) {
        require(address(priceFeed) != address(0), "OtoCoMasterV2: Price feed not set");
        
        (uint80 roundId, int256 quote, , uint256 updatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();
        
        require(quote > 0, "OtoCoMasterV2: Invalid price feed");
        require(answeredInRound >= roundId, "OtoCoMasterV2: Stale price");
        require(updatedAt > block.timestamp - 3600, "OtoCoMasterV2: Price too old");
        
        return (priceFeedEth/uint256(quote))*usdPrice;
    }

    /**
     * Upgradeable contract initializer.
     *
     * @param jurisdictionAddresses Initial juridiction pre-deployed addresses.
     * @param url Initial external URL.
     * @param _priceFeed Chainlink price feed address.
     */
    function initialize(address[] calldata jurisdictionAddresses, string calldata url, address _priceFeed) initializer external {
        __Ownable_init();
        __ERC721_init("OtoCo Series", "OTOCO");
        __ReentrancyGuard_init();
        
        require(_priceFeed != address(0), "OtoCoMasterV2: Invalid price feed");
        
        uint16 counter = uint16(jurisdictionAddresses.length);
        for (uint16 i = 0; i < counter; i++){
            jurisdictionAddress[i] = jurisdictionAddresses[i];
        }
        jurisdictionCount = counter;
        baseFee = 10;
        externalUrl = url;
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    /**
     * Create a new Series at specific jurisdiction and also select its name.
     *
     * @param jurisdiction Jurisdiction that will store entity.
     * @param controller who will control the entity.
     * @param name the legal name of the entity.
     */
    function createSeries(uint16 jurisdiction, address controller, string memory name) 
    public enoughAmountUSD(
        IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getJurisdictionDeployPrice()
    ) payable {
        require(jurisdiction < jurisdictionCount, "OtoCoMasterV2: Invalid jurisdiction");
        require(jurisdictionAddress[jurisdiction] != address(0), "OtoCoMasterV2: Jurisdiction not set");
        
        if (IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).isStandalone() == true) {
            revert NotAllowed();
        }

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

    /**
     * Create a new Series with initializer contract and custom plugins.
     * The initializer deployed will own the entity after deployment.
     *
     * @param jurisdiction Jurisdiction that will store entity.
     * @param plugins The array of plugin addresses to be called. The index 0 is the initializer.
     * @param pluginsData The array of pluginData to be used as parameters. Index 0 is initializer params.
     * @param value The array of values to be send for each plugins. Index 0 is initializer value.
     * @param name the legal name of the entity.
     */
    function createEntityWithInitializer(
        uint16 jurisdiction,
        address[] calldata plugins,
        bytes[] calldata pluginsData,
        uint256 value,
        string calldata name
    ) public payable nonReentrant {
        require(jurisdiction < jurisdictionCount, "OtoCoMasterV2: Invalid jurisdiction");
        require(jurisdictionAddress[jurisdiction] != address(0), "OtoCoMasterV2: Jurisdiction not set");
        
        if (IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).isStandalone() == true) {
            revert NotAllowed();
        }
        
        // Admin wallets can skip fees
        if (!isAdmin[msg.sender]) {
            uint256 valueRequired = gasleft()*baseFee
                + priceConverter(IOtoCoJurisdiction(jurisdictionAddress[jurisdiction]).getJurisdictionDeployPrice())
                + value;
            if (msg.value < valueRequired) revert InsufficientValue({
                available: msg.value,
                required: valueRequired
            });
        }
        
        address controller = msg.sender;
        if (plugins[0] != address(0x0)) {
            (bool success, bytes memory initializerBytes) = plugins[0].call{value: value}(pluginsData[0]);
            if (!success || plugins[0].code.length == 0) revert InitializerError();
            assembly {
                controller := mload(add(initializerBytes,32))
            }
        }
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        createSeries(jurisdiction, controller, name);
        for (uint8 i=1; i<plugins.length; i++){
            IOtoCoPlugin(plugins[i]).addPlugin(current, pluginsData[i]);
        }
    }

    /**
     * Extend entity expiration date.
     *
     * @param tokenId Token id related to the entity to be renewed
     * @param periodInYears Period in Years to be extended
     */
    function renewEntity(uint256 tokenId, uint256 periodInYears) payable external {
        require(_exists(tokenId), "OtoCoMasterV2: Entity does not exist");
        require(periodInYears > 0 && periodInYears <= 100, "OtoCoMasterV2: Invalid period");
        
        Series storage s = series[tokenId];
        uint256 renewalPrice = 
            priceConverter(IOtoCoJurisdiction(jurisdictionAddress[s.jurisdiction]).getJurisdictionRenewalPrice());

        if(msg.value < (renewalPrice * periodInYears)) revert InsufficientValue({
            available: msg.value,
            required: (renewalPrice * periodInYears)
        });
        
        // 31536000 = 1 Year of renewal in seconds
        if (s.expiration < 1) { s.expiration = uint64(block.timestamp); }
        
        // Check for overflow before adding
        uint64 extensionSeconds = uint64(31536000 * periodInYears);
        require(s.expiration <= type(uint64).max - extensionSeconds, "OtoCoMasterV2: Expiration overflow");
        
        s.expiration += extensionSeconds;
    }

    /**
     * Close series previously created.
     *
     * @param tokenId of the series to be burned.
     */
    function closeSeries(uint256 tokenId) public enoughAmountUSD(
        IOtoCoJurisdiction(jurisdictionAddress[series[tokenId].jurisdiction]).getJurisdictionClosePrice()
    ) payable {
        if(ownerOf(tokenId) != msg.sender) revert IncorrectOwner();
        _burn(tokenId);
    }

    function setDocs(uint256 tokenId, string memory documentation) external {
        if(ownerOf(tokenId) != msg.sender) revert IncorrectOwner();
        docs[tokenId] = documentation;

        emit DocsUpdated(tokenId);
    }

    receive() enoughAmountFees() external payable {}

    // --- ADMINISTRATION FUNCTIONS ---

    /**
     * Add a new jurisdiction to the contract
     *
     * @param newAddress the address of the jurisdiction.
     */
    function addJurisdiction(address newAddress) external onlyOwnerOrAdmin {
        require(newAddress != address(0), "OtoCoMasterV2: Invalid jurisdiction address");
        
        jurisdictionAddress[jurisdictionCount] = newAddress;
        emit JurisdictionAdded(jurisdictionCount, newAddress);
        jurisdictionCount++;
    } 

    /**
     * Update a jurisdiction to the contract
     *
     * @param jurisdiction the index of the jurisdiction.
     * @param newAddress the new address of the jurisdiction.
     */
    function updateJurisdiction(uint16 jurisdiction, address newAddress) external onlyOwnerOrAdmin {
        require(jurisdiction < jurisdictionCount, "OtoCoMasterV2: Invalid jurisdiction");
        require(newAddress != address(0), "OtoCoMasterV2: Invalid jurisdiction address");
        
        address oldAddress = jurisdictionAddress[jurisdiction];
        jurisdictionAddress[jurisdiction] = newAddress;
        emit JurisdictionUpdated(jurisdiction, oldAddress, newAddress);
    }

    /**
     * Change creation fees charged for entity creation, plugin addition/modification/removal.
     *
     * @param newFee new price to be charged for base fees.
     */
    function changeBaseFees(uint256 newFee) external onlyOwnerOrAdmin {
        baseFee = newFee;
        emit BaseFeeChanged(newFee);
    }

    /**
     * Replace marketplace Address to the contract
     *
     * @param addresses the address of the jurisdiction.
     * @param enabled the address of the jurisdiction.
     */
    function setMarketplaceAddresses(address[] calldata addresses, bool[] calldata enabled) external onlyOwnerOrAdmin {
        require(addresses.length == enabled.length, "OtoCoMasterV2: Array length mismatch");
        
        uint256 i;
        uint256 addressesSize = addresses.length;  
        for (i; i < addressesSize;){
            marketplaceAddress[addresses[i]] = enabled[i];
            unchecked { ++i; }
        }
    }

    /**
     * Replace URI builder contract
     *
     * @param newEntitiesURI New URI builder contract
     */
    function changeURISources(address newEntitiesURI) external onlyOwnerOrAdmin {
        entitiesURI = IOtoCoURI(newEntitiesURI);
        emit ChangedURISource(newEntitiesURI);
    }

    /**
     * Replace Price Feed source
     *
     * @param newPriceFeed New price feed address
     */
    function changePriceFeed(address newPriceFeed) external onlyOwnerOrAdmin {
        priceFeed = AggregatorV3Interface(newPriceFeed);
        emit UpdatedPriceFeed(newPriceFeed);
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
     * Withdraw fees paid by series creation.
     * Fees are transferred to the withdrawal wallet.
     * Can be called by owner or admin wallets.
     *
     * Emits a {FeesWithdraw} event.
     */
    function withdrawFees() external onlyOwnerOrAdmin {
        uint256 balance = address(this).balance;
        require(balance > 0, "OtoCoMasterV2: No balance to withdraw");
        
        address recipient = withdrawalWallet != address(0) ? withdrawalWallet : owner();
        
        (bool success, ) = payable(recipient).call{value: balance}("");
        require(success, "OtoCoMasterV2: Transfer failed");
        
        emit FeesWithdrawn(recipient, balance);
    }

    /**
     * Set the withdrawal wallet address where fees will be sent.
     *
     * @param _withdrawalWallet The address of the withdrawal wallet.
     */
    function setWithdrawalWallet(address _withdrawalWallet) external onlyOwner {
        address oldWallet = withdrawalWallet;
        withdrawalWallet = _withdrawalWallet;
        emit WithdrawalWalletUpdated(oldWallet, _withdrawalWallet);
    }

    /**
     * Get the withdrawal wallet address.
     *
     * @return The address of the withdrawal wallet.
     */
    function getWithdrawalWallet() external view returns (address) {
        return withdrawalWallet;
    }

    /**
     * Add an admin wallet to the admin array.
     * Admin wallets can perform owner functions and create entities for free.
     *
     * @param admin The address to add as an admin.
     */
    function addAdmin(address admin) external onlyOwner {
        require(!isAdmin[admin], "OtoCoMasterV2: Address is already an admin");
        require(admin != address(0), "OtoCoMasterV2: Cannot add zero address as admin");
        
        adminWallets.push(admin);
        isAdmin[admin] = true;
        
        emit AdminAdded(admin);
    }

    /**
     * Remove an admin wallet from the admin array.
     *
     * @param admin The address to remove from admins.
     */
    function removeAdmin(address admin) external onlyOwner {
        require(isAdmin[admin], "OtoCoMasterV2: Address is not an admin");
        
        isAdmin[admin] = false;
        
        // Remove from array
        for (uint256 i = 0; i < adminWallets.length; i++) {
            if (adminWallets[i] == admin) {
                adminWallets[i] = adminWallets[adminWallets.length - 1];
                adminWallets.pop();
                break;
            }
        }
        
        emit AdminRemoved(admin);
    }

    /**
     * Get all admin wallets.
     *
     * @return Array of admin wallet addresses.
     */
    function getAdminWallets() external view returns (address[] memory) {
        return adminWallets;
    }

    /**
     * Check if an address is an admin.
     *
     * @param account The address to check.
     * @return Boolean indicating if the address is an admin.
     */
    function checkIsAdmin(address account) external view returns (bool) {
        return isAdmin[account];
    }

    /**
     * Update the name of an existing entity.
     * Can be called by owner or admin wallets for free.
     *
     * @param tokenId The token ID of the entity to update.
     * @param newName The new name for the entity.
     */
    function updateEntityName(uint256 tokenId, string calldata newName) external onlyOwnerOrAdmin {
        require(_exists(tokenId), "OtoCoMasterV2: Entity does not exist");
        require(bytes(newName).length > 0, "OtoCoMasterV2: Name cannot be empty");
        
        // Update the name in storage
        series[tokenId].name = newName;
        
        // Emit event for transparency
        emit EntityNameUpdated(tokenId, newName, msg.sender);
    }

    // -- TOKEN VISUALS AND DESCRIPTIVE ELEMENTS --

    /**
     * Get the tokenURI that points to a image.
     * Returns the JSON formatted accordingly with Base64.
     *
     * @param tokenId must exist.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "OtoCoMasterV2: Token does not exist");
        require(address(entitiesURI) != address(0), "OtoCoMasterV2: URI source not set");
        
        return entitiesURI.tokenExternalURI(tokenId, lastMigrated);
    }
}