// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';

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

    ENS ens;
    bytes32 rootNode;
    Resolver defaultResolver;
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
     * @param node The node that this registrar administers.
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
    
    function resolve(address addr, uint8 index) public view returns(string memory) {
        return seriesDomains[addr][index];
    }
    
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