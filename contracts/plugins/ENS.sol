// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../utils/OtoCoPlugin.sol";

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
 * A registrar that stores subdomains to the first person who claim them.
 */
contract ENSRegistrar is OtoCoPlugin {

    event SubdomainClaimed(uint256 indexed series, string value);

    // Master ENS registry
    ENS public ens;
    // The otoco.eth node reference
    bytes32 public rootNode;
    // Default resolver to deal with data storage
    Resolver public defaultResolver;
    // Mapping of Company address => Domains
    mapping(uint256 => string[]) internal seriesDomains;

    /*
     * Constructor.
     *
     * @param ensAddr The address of the ENS registry.
     * @param resolverAddr The resolver where domains will use to register.
     * @param node The node that this registrar administers.
     * @param previousSeries Previous series to be migrated.
     * @param previousDomains Previous domains to be migrated.
     */
    constructor (
        address otocoMaster,
        ENS ensAddr,
        Resolver resolverAddr,
        bytes32 node,
        uint256[] memory prevSeries,
        string[] memory prevDomains
    ) OtoCoPlugin(otocoMaster) {
        ens = ensAddr;
        rootNode = node;
        defaultResolver = resolverAddr;
        for (uint i = 0; i < prevSeries.length; i++ ) {
            emit SubdomainClaimed(prevSeries[i], prevDomains[i]);
            seriesDomains[prevSeries[i]].push(prevDomains[i]);
        }
    }

    /**
     * Register a name, and store the domain to reverse lookup.
     *
     * @param pluginData Encoded parameters to create a new token.
     * @dev domain The string containing the domain.
     * @dev target Series contract that registry will point.
     * @dev addr Address to redirect domain
     */
     function addPlugin(bytes calldata pluginData) public payable override {
        require(msg.value >= tx.gasprice * gasleft() / otocoMaster.getBaseFees(), "OtoCoPlugin: Not enough ETH paid for the transaction.");
        (
            uint256 seriesId,
            string memory domain,
            address addr
        ) = abi.decode(pluginData, (uint256, string, address));
        require(isSeriesOwner(seriesId), "OtoCoPlugin: Not the entity owner.");
        payable(otocoMaster).transfer(msg.value);
        bytes32 label = keccak256(abi.encodePacked(domain));
        register(label, msg.sender, addr);
        seriesDomains[seriesId].push(domain);
        emit SubdomainClaimed(seriesId, domain);
    }

    /**
     * Register a name, or change the owner of an existing registration.
     * @param label The hash of the label to register.
     * @param owner The address of the new owner(Series Manager).
     * @param addr Address to redirect domain
     */
    function register(bytes32 label, address owner, address addr) internal {
        bytes32 node = keccak256(abi.encodePacked(rootNode, label));
        ens.setSubnodeRecord(rootNode, label, address(this), address(defaultResolver), 63072000);
        defaultResolver.setAddr(node, addr);
        ens.setOwner(node, owner);
    }

    /**
     * Allow attach a previously deployed plugin if possible
     * @dev This function should run enumerous amounts of verifications before allow the attachment.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function attachPlugin(bytes calldata pluginData) public payable override {
        require(false, "ENS Plugin: Attach domains are not possible on this plugin.");
    }

    /**
     * Plugin initializer with a fuinction template to be used.
     * @dev To decode initialization data use i.e.: (string memory name) = abi.decode(pluginData, (string));
     *
     * @param pluginData The parameters to remove a instance of the plugin.
     */
    function removePlugin(bytes calldata pluginData) public payable override {
        require(false, "ENS Plugin: Remove domains are not possible on this plugin.");
    }
}