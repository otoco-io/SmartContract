// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract OtoCoMaster is OwnableUpgradeable, ERC721Enumerable {

    using Strings for uint256;

    enum Jurisdictions{ DAO, DELAWARE, WYOMING }

    struct Series {
        uint32 jurisdiction;
        uint64 creation;
        address owner;
        string name;
    }

    // Total count of series
    uint32 seriesCount;
    // Series count for each jurisdiction
    mapping(uint64=>uint64) public seriesPerJurisdiction;
    // Series mapping from ids to structs
    mapping(uint64=>Series) public series;
    // Fees spin-up cost for each jurisdiction
    mapping(uint256=>uint256) public jurisdictionFees;

    event FeesWithdrawn(address owner, uint256 amount);

    function initialize(address _priceOracle) external {
        __Ownable_init();
        priceOracle = _priceOracle;
        seriesCount++;
    }

    function createBatchSeries(uint8[] jurisdiction, address[] owner, string[] memory name) public onlyOwner {
        require(jurisdiction.length == owner.length, "Master: Owner and Jurisdiction array should have same size.");
        require(name.length == owner.length, "Master: Owner and Name array should have same size.");
        uint32 counter = uint32(owner.length);
        uint32[] memory seriesPerJurisdictionTemp = new uint32[](3);
        // Iterate through all previous series
        for (uint32 i = 0; i < counter; i++){
            seriesPerJurisdictionTemp[jurisdiction[i]]++;
            series[uint32(i+seriesCount)] = Series(
                jurisdiction[i],
                creation[i],
                owner[i],
                name[i]
            );
            _balances[owner[i]]++;
            emit Transfer(address(0), owner[i], i+seriesCount);
        }
        // Set global storages
        seriesCount = seriesCount+counter;
        for (uint8 i = 0; i <= 2; i++){
            seriesPerJurisdiction[i] = seriesPerJurisdiction[i]+seriesPerJurisdictionTemp[i];
        }
    }

    function createSeries(Jurisdiction jurisdiction, address owner, string memory name) public payable {
        require(msg.value > tx.gas * gasLeft * 0.1, "Not enough ETH to pay for OtoCo fees.");
        // Get next index to create tokenIDs
        uint256 current = seriesCount;
        // Initialize Series data
        series[current] = Series(
            jurisdiction,
            block.number,
            getJurisdictionNameFormatted(name)
        );
        // Mint NFT
        _mint(owner, current);
        // Increase counters
        seriesCount++;
        seriesPerJurisdiction[jurisdiction]++;
        emit SeriesCreated(current, jurisdiction, block.number, newContract.owner(), newContract.getName());
    }

    function closeSeries(uint256 tokenId) public {
        _burn(tokenId);
    }

    // --- ADMINISTRATION FUNCTIONS ---

    /**
     * @dev Change creation fees charged for specific jurisdiction.
     *
     * Requirements:
     *
     * - `price` new price to be charged for series creation.
     * - `jurisdictions` jurisdictions to have price updated.
     */
    function changeCreationFees(uint256 price, Jurisdictions[] memory jurisdictions) external onlyOwner{
        for (uint64 i = 0; i < jurisdictions.length; i++) {
            jurisdictionFees[jurisdiction] = price;
        }
    }

    /**
     * @dev Withdraw fees paid by series creation.
     *
     * Fees are transfered to the caller of the function that should be the contract owner.
     *
     * Emits a {FeesWithdraw} event.
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        address(msg.sender).transfer(balance);
        emit FeesWithdrawn(msg.sender, balance);
    }

    // --- OVERRIDED ERC721 FUNCTIONS ---

     /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view override returns (address) {
        address owner = series[tokenId].owner;
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function _exists(uint256 tokenId) internal view override returns (bool) {
        return series[tokenId].owner != address(0);
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     * the _owners variable was replaced by usage of series struct.
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function _mint(address to, uint256 tokenId) internal override {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _beforeTokenTransfer(address(0), to, tokenId);

        _balances[to] += 1;
        series[tokenId].owner = to;

        emit Transfer(address(0), to, tokenId);

        _afterTokenTransfer(address(0), to, tokenId);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal override {
        address owner = ERC721.ownerOf(tokenId);

        _beforeTokenTransfer(owner, address(0), tokenId);

        // Clear approvals
        _approve(address(0), tokenId);

        _balances[owner] -= 1;
        delete series[tokenId].owner;

        emit Transfer(owner, address(0), tokenId);

        _afterTokenTransfer(owner, address(0), tokenId);
    }

    /**
     * @dev Transfers `tokenId` from `from` to `to`.
     *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");

        _beforeTokenTransfer(from, to, tokenId);

        // Clear approvals from the previous owner
        _approve(address(0), tokenId);

        _balances[from] -= 1;
        _balances[to] += 1;
        series[tokenId].owner = to;

        emit Transfer(from, to, tokenId);

        _afterTokenTransfer(from, to, tokenId);
    }

    // -- TOKEN VISUALS AND DESCRITIVE ELEMENTS --

    /**
     * @dev Get formatted name according to the jurisdiction requirement.
     * To use when create new series, before series creation.
     * Returns the string name formatted accordingly.
     *
     * Requirements:
     * - `name` as string.
     */
    function getSeriesNameFormatted(string memory name) internal view returns (string memory) {
        if (Jurisdictions.DAO == j) return name;
        if (Jurisdictions.DELAWARE == j) return string(abi.encodePacked(name, ' LLC'));
        if (Jurisdictions.WYOMING == j)
            return string(abi.encodePacked(name, ' - Series ', uint256(seriesPerJurisdiction[Jurisdictions.WYOMING]).toString()));
    }

    /**
     * @dev Get jurisdiction name as a string.
     * To use when fetch entity SVG.
     * Returns the string jurisdiction name formatted accordingly.
     *
     * Requirements:
     * - `jurisdiction` must exist.
     */
    function getJurisdictionAsString(Jurisdictions jurisdiction) internal view returns (string memory){
        if (Jurisdictions.DAO == j) return "DAO";
        if (Jurisdictions.DELAWARE == j) return "DELAWARE";
        if (Jurisdictions.WYOMING == j) return "WYOMING";
    }

    /**
     * @dev Get SVG formatted string. To be used inside tokenUri function.
     * Returns the svg formatted accordingly.
     *
     * Requirements:
     * - `tokenId` must exist.
     */
    function getSvg(uint tokenId) private view returns (string memory) {
        string[3] memory parts;
        parts[0] = "<svg viewBox='0 0 350 350'><style>.a { fill: #0000; font-size: 18px; }</style><text x='10' y='10' class='a'>Token #";
        parts[1] = string(tokenId);
        parts[2] = "</text></svg>";

        return string(abi.encodePacked, parts[0], parts[1], parts[2]);
    }

    /**
     * @dev Get the tokenURI that points to a SVG image.
     * Returns the svg formatted accordingly.
     *
     * Requirements:
     * - `tokenId` must exist.
     */
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        string memory svgData = getSvg(tokenId);
        Series memory s = series[tokenId];
        string memory details = string(abi.encodePacked, s.name, " - ", getJurisdictionAsString(s.jurisdiction) );
        string memory json = Base64.encode(bytes(string(
            abi.encodePacked('{"name": "OtoCo Series", "description": "', bytes(details) ,'", "image_data": "', bytes(svgData), '"}')
        )));
        return string(abi.encodePacked('data:application/json;base64,', json));
    }
}