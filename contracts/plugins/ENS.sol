// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

interface ENS {
    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external;
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns(bytes32);
    function setOwner(bytes32 node, address owner) external;
    function owner(bytes32 node) external view returns (address);
}

interface Resolver{
    function setAddr(bytes32 node, address addr) external;
    function setAddr(bytes32 node, uint coinType, bytes calldata a) external;
}


/**
 * A registrar that allocates subdomains to the first person to claim them.
 */
contract ENSRegistrar is Initializable, OwnableUpgradeable {
    
    event NameClaimed(address indexed series, string value);

    // Master ENS registry
    ENS ens;
    // The otoco.eth node reference
    bytes32 rootNode;
    // Default resolver to deal with data storage
    Resolver defaultResolver;
    // Mapping of Company address => Domains
    mapping(address => string[]) internal seriesDomains;

    modifier only_owner(bytes32 label) {
        address currentOwner = ens.owner(keccak256(abi.encodePacked(rootNode, label)));
        require(currentOwner == address(0x0) || currentOwner == msg.sender);
        _;
    }
    
    modifier only_series_manager(OwnableUpgradeable series) {
        require(series.owner() == msg.sender, 'Not the series manager.');
        _;
    }

    /**
     * Constructor.
     * @param ensAddr The address of the ENS registry.
     * @param resolverAddr The resolver where domains will use to register.
     * @param node The node that this registrar administers.
     * @param previousSeries Previous series to be migrated.
     * @param previousDomains Previous domains to be migrated.
     */
    function initialize(ENS ensAddr, Resolver resolverAddr, bytes32 node, address[] calldata previousSeries, bytes32[] calldata previousDomains) external {
        require(previousSeries.length == previousDomains.length, 'Previous series size different than previous tokens size.');
        __Ownable_init();
        ens = ensAddr;
        rootNode = node;
        defaultResolver = resolverAddr;
        for (uint i = 0; i < previousSeries.length; i++ ) {
            emit NameClaimed(previousSeries[i], bytes32ToString(previousDomains[i]));
            seriesDomains[previousSeries[i]].push(bytes32ToString(previousDomains[i]));
        }
    }

    /**
     * Register a name, or change the owner of an existing registration.
     * @param label The hash of the label to register.
     * @param owner The address of the new owner(Series Manager).
     * @param addr Address to redirect domain
     */
    function register(bytes32 label, address owner, address addr) public only_owner(label) {
        bytes32 node = keccak256(abi.encodePacked(rootNode, label));
        ens.setSubnodeRecord(rootNode, label, address(this), address(defaultResolver) ,63072000);
        defaultResolver.setAddr(node, addr);
        ens.setOwner(node, owner);
    }
    
    /**
     * Register a name, and store the domain to reverse lookup.
     * @param domain The string containing the domain.
     * @param target Series contract that registry will point.
     * @param addr Address to redirect domain
     */
    function registerAndStore(string memory domain, OwnableUpgradeable target, address addr) public only_series_manager(target) {
        bytes32 label = keccak256(abi.encodePacked(domain));
        register(label, msg.sender, addr);
        seriesDomains[address(target)].push(domain);
        emit NameClaimed(address(target), domain);
    }
    
    /**
     * Return some domain from a series. As a single series could claim multiple domains, 
     * the resolve function here has a index parameter to point a specific domain to be retrieved.
     * @param addr The string containing the addr.
     * @param index Domain index to be retrieved.
     */
    function resolve(address addr, uint8 index) public view returns(string memory) {
        return seriesDomains[addr][index];
    }
    
    /**
     * Return how much domains the Series has registered using this Registrar.
     * @param addr The string containing the series address.
     */
    function ownedDomains(address addr) public view returns(uint) {
        return seriesDomains[addr].length;
    }

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}