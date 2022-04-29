// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../OtoCoPlugin.sol";

interface IENS {
    function setSubnodeRecord(bytes32 node, bytes32 label, address _owner, address resolver, uint64 ttl) external;
    function setSubnodeOwner(bytes32 node, bytes32 label, address _owner) external returns(bytes32);
    function setOwner(bytes32 node, address _owner) external;
    function owner(bytes32 node) external view returns (address);
}

interface IResolver{
    function setAddr(bytes32 node, address addr) external;
    function setAddr(bytes32 node, uint coinType, bytes calldata a) external;
}

/**
 * A registrar that stores subdomains to the first person who claim them.
 */
contract ENS is OtoCoPlugin {

    event SubdomainClaimed(uint256 indexed series, string value);

    // Master ENS registry
    IENS public ens;
    // The otoco.eth node reference
    bytes32 public rootNode;
    // Default resolver to deal with data storage
    IResolver public defaultResolver;
    // Mapping from entities to created domains
    mapping(uint256 => uint256) public domainsPerEntity;
    // Mapping of Company address => Domains
    mapping(uint256 => string[]) public seriesDomains;

    modifier notOwned(bytes32 label) {
        address currentOwner = ens.owner(keccak256(abi.encodePacked(rootNode, label)));
        require(currentOwner == address(0x0), "ENSPlugin: Domain alredy registered.");
        _;
    }

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
        address payable otocoMaster,
        IENS ensAddr,
        IResolver resolverAddr,
        bytes32 node,
        uint256[] memory prevSeries,
        string[] memory prevDomains
    ) OtoCoPlugin(otocoMaster) {
        ens = ensAddr;
        rootNode = node;
        defaultResolver = resolverAddr;
        for (uint i = 0; i < prevSeries.length; i++ ) {
            emit SubdomainClaimed(prevSeries[i], prevDomains[i]);
            domainsPerEntity[prevSeries[i]]++;
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
     function addPlugin(uint256 seriesId, bytes calldata pluginData) public  onlySeriesOwner(seriesId) transferFees() payable override {
        (
            string memory domain,
            address owner
        ) = abi.decode(pluginData, (string, address));
        bytes32 label = keccak256(abi.encodePacked(domain));
        register(label, owner);
        seriesDomains[seriesId].push(domain);
        domainsPerEntity[seriesId]++;
        emit SubdomainClaimed(seriesId, domain);
    }

    /**
     * Register a name, or change the owner of an existing registration.
     * @param label The hash of the label to register.
     * @param owner The address of the new owner.
     */
    function register(bytes32 label, address owner) internal notOwned(label) {
        bytes32 node = keccak256(abi.encodePacked(rootNode, label));
        ens.setSubnodeRecord(rootNode, label, address(this), address(defaultResolver), 63072000000000);
        defaultResolver.setAddr(node, owner);
        ens.setOwner(node, owner);
    }

}