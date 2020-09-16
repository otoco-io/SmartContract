pragma solidity ^0.5.0;

import "github.com/ensdomains/ens/blob/master/contracts/ENS.sol";
import "github.com/ensdomains/resolvers/blob/master/contracts/Resolver.sol";

interface Ownable {
    function owner() external view returns (address);
}

/**
 * A registrar that allocates subdomains to the first person to claim them.
 */
contract OtocoRegistrar {
    
    ENS ens;
    bytes32 rootNode;
    Resolver defaultResolver;
    mapping(address => string[]) internal seriesDomains;

    modifier only_owner(bytes32 label) {
        address currentOwner = ens.owner(keccak256(abi.encodePacked(rootNode, label)));
        require(currentOwner == address(0x0) || currentOwner == msg.sender);
        _;
    }
    
    modifier only_series_manager(Ownable series) {
        require(series.owner() == msg.sender, 'Not the series manager.');
        _;
    }

    /**
     * Constructor.
     * @param ensAddr The address of the ENS registry.
     * @param node The node that this registrar administers.
     */
    constructor(ENS ensAddr, Resolver resolverAddr, bytes32 node ) public {
        ens = ensAddr;
        rootNode = node;
        defaultResolver = resolverAddr;
    }

    /**
     * Register a name, or change the owner of an existing registration.
     * @param label The hash of the label to register.
     * @param owner The address of the new owner(Series Manager).
     * @param target Series contract that addr attribute will point.
     */
    function register(bytes32 label, address owner, address target) public only_owner(label) {
        bytes32 node = keccak256(abi.encodePacked(rootNode, label));
        ens.setSubnodeRecord(rootNode, label, address(this), address(defaultResolver) ,63072000);
        defaultResolver.setAddr(node, target);
        ens.setOwner(node, owner);
    }
    
    /**
     * Register a name, and store the domain to reverse lookup.
     * @param domain The string containing the domain.
     * @param target Series contract that addr attribute will point.
     */
    function registerAndStore(string memory domain, Ownable target) public only_series_manager(target) {
        bytes32 label = keccak256(abi.encodePacked(domain));
        register(label, msg.sender, address(target));
        seriesDomains[address(target)].push(domain);
    }
    
    function resolve(address addr, uint8 index) public view returns(string memory) {
        return seriesDomains[addr][index];
    }
    
    function ownedDomains(address addr) public view returns(uint) {
        return seriesDomains[addr].length;
    }
}