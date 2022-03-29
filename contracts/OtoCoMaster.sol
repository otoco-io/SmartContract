// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface ChainlinkPriceOracle {
    function latestRoundData() public view virtual override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );
}

contract OtoCoMaster is OwnableUpgradeable, ERC721Enumerable {

    using Counters for Counters.Counter;
    enum Jurisdictions{ DAO, DELAWARE, WYOMING }
    struct SeriesEnumerated {
        uint256 index;
        Jurisdictions jurisdiction;
        uint256 creation;
        string name;
    }
    struct Series {
        Jurisdictions jurisdiction;
        uint256 creation;
        string name;
    }

    // Chainlink price oracle fee address
    address public priceOracle;
    // Total count of series
    Counters.Counter private seriesCount;
    // Series count for each jurisdiction
    mapping(uint256=>Counters.Counter) public seriesPerJurisdiction;

    // Series mapping from ids to structs
    mapping(uint256=>Series) public series;
    // Fees spin-up cost for each jurisdiction
    mapping(uint256=>uint256) public feesPerJurisdiction;

    event SeriesCreated(uint256 seriesId, uint256 jurisdiction, uint256 creation, address owner, string name);
    event JurisdictionFeeChanged(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address owner, uint256 total);

    function initialize(address _priceOracle) external {
        __Ownable_init();
        priceOracle = _priceOracle;
        feesPerJurisdiction[Jurisdictions.DELAWARE] = 39 ether;
        feesPerJurisdiction[Jurisdictions.WYOMING] = 39 ether;
    }

    function changePriceOracle(address oracle) external onlyOwner{
        priceOracle = oracle;
    }

    function changeCreationFees(uint256 price, Jurisdictions jurisdiction) external onlyOwner{
        feesPerJurisdiction[jurisdiction] = price;
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        address(msg.sender).transfer(balance);
        emit FeesWithdrawn(msg.sender, balance);
    }

    function createSeries(Jurisdiction jurisdiction, address owner, string memory name) public payable {
        
        // msg.value is enough
        
        // compare names to not happen collisions?
        
        // Check user
        seriesCount.increment();
        _mint(owner, seriesCount.current());
        emit SeriesCreated(seriesCount.current(),  newContract.owner(), newContract.getName());
    }

    function closeSeries(uint256 id) public {
        _burn(id);
    }

    function SeriesList(address owner) public view returns (SeriesEnumerated[] memory) {
        SeriesEnumerated[] owned = [];
        for (uint256 i = 0; i < balance(owner); i++){
            // Get current global series index
            uint256 ci = tokenOfOwnerByIndex(owner, i);
            // Get series data
            Series memory cs = series[ci];
            owned.push(SeriesEnumerated(ci, cs.jurisdiction, cs.creation, cs.name));
        }
        return owned;
    }

    function getJurisdictionAsString(Jurisdictions j) public view returns (string memory){
        if (Jurisdictions.DAO == j) return "DAO";
        if (Jurisdictions.DELAWARE == j) return "DELAWARE";
        if (Jurisdictions.WYOMING == j) return "WYOMING";
    }

    function getSvg(uint tokenId) private view returns (string memory) {
        string[3] memory parts;
        parts[0] = "<svg viewBox='0 0 350 350'><style>.a { fill: #0000; font-size: 18px; }</style><text x='10' y='10' class='a'>Token #";
        parts[1] = string(tokenId);
        parts[2] = "</text></svg>";

        return string(abi.encodePacked, parts[0], parts[1], parts[2]);
    }

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