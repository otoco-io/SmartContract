pragma solidity ^0.5.0;

import "./ENS.sol";
import "./Resolver.sol";

/**
 * A registrar that allocates subdomains to the first person to claim them.
 */
contract OtocoRegistrar {
    ENS ens;
    Resolver defaultResolver;
    bytes32 rootNode;

    modifier only_owner(bytes32 label) {
        address currentOwner = ens.owner(keccak256(abi.encodePacked(rootNode, label)));
        require(currentOwner == address(0x0) || currentOwner == msg.sender);
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
     * @param owner The address of the new owner.
     */
    function register(bytes32 label, address owner, address target) public only_owner(label) {
        bytes32 node = keccak256(abi.encodePacked(rootNode, label));
        ens.setSubnodeRecord(rootNode, label, address(this), address(defaultResolver) ,63072000);
        defaultResolver.setAddr(node, target);
        ens.setOwner(node, owner);
    }
}