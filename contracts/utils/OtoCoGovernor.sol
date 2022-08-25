// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../governor/GovernorNoEIP712NoName.sol";
import "../governor/InitializableEIP712.sol";
import "../governor/InitializableGovernorSettings.sol";
import "../governor/InitializableGovernorVotes.sol";
import "../governor/InitializableGovernorCountingSimple.sol";
import "../governor/InitializableGovernorQuorumFraction.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract OtoCoGovernor is 
Initializable,
GovernorNoEIP712NoName,
InitializableGovernorVotes,
InitializableGovernorSettings,
InitializableGovernorQuorumFraction,
InitializableGovernorCountingSimple,
InitializableEIP712 {
    
    // Overrided name from source contract
    string private _name;
    // Manager address could create proposal for a set of contracts and execute whitout quorum
    address private _manager;
    // Map what proposals are managerProposals
    mapping(uint256=>bool) private _managerProposal;
    // Allowed contract permitted to Manager interact without requiring quorum
    mapping(address=>bool) private _allowedContracts;

    constructor() {
        _disableInitializers();
    }

    function initialize (
    	address _token,
    	address _firstManager,
    	address[] memory _allowed,
    	uint256 _votingPeriod,
    	string memory _contractName
    )
        initializer public
    {
        _name = _contractName;
    	_manager = _firstManager;
        __EIP712_init(_contractName, version());
        __GovernorVotes_init(IVotes(_token));
        _setVotingDelay(1);
        _setVotingPeriod(_votingPeriod);
        _setProposalThreshold(1);
        _updateQuorumNumerator(50);
    	for (uint i = 0; i < _allowed.length; i++) {
            _allowedContracts[_allowed[i]] = true;
        }
    }

    // The following functions are overrides required by Solidity.

    /**
     * @dev See {IGovernor-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function votingDelay()
        public
        view
        override(IGovernor, InitializableGovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, InitializableGovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, InitializableGovernorQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    // OtoCo Governor implementations

    /**
     * Manager proposals doesn't require quorum to be valid
     */
    function _quorumReached(uint256 proposalId)
        internal
        view
        virtual
        override(GovernorNoEIP712NoName, InitializableGovernorCountingSimple) 
        returns (bool) 
    {
        if (_managerProposal[proposalId]) return true;
        return super._quorumReached(proposalId);
    }

    /**
     * Manager proposals not require proposalThreshold from manager
     */
    function proposalThreshold()
        public
        view
        override(GovernorNoEIP712NoName, InitializableGovernorSettings)
        returns (uint256)
    {
        if (_msgSender() == _manager) return 0;
        return super.proposalThreshold();
    }

    /**
     * Return if vote was succeeded with for votes bigger than against votes.
     * Note: Manager proposals is also true in case of equal for and against votes
     */
    function _voteSucceeded(uint256 proposalId)
        internal
        view
        virtual
        override(GovernorNoEIP712NoName, InitializableGovernorCountingSimple)
        returns (bool)
    {
        (uint256 againstVotes,uint256 forVotes,) = proposalVotes(proposalId);
        if (_managerProposal[proposalId]) return forVotes >= againstVotes;
        // return forVotes > quorum(proposalSnapshot(proposalId)) && forVotes > againstVotes;
        return forVotes > againstVotes;
    }

    /**
     * @dev See {IGovernor-propose}.
     * Note: Propose is changed to allow Manager to create proposals without proposalThreshold
     */
    function propose(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description
    ) public virtual override returns (uint256) {
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        if (_msgSender() == _manager && isAllowedContracts(targets)){
            _managerProposal[proposalId] = true;
        }
        return proposalId;
    }

    /**
     * @dev Internal cancel mechanism: locks up the proposal timer, preventing it from being re-submitted. Marks it as
     * canceled to allow distinguishing it from executed proposals.
     *
     * Emits a {IGovernor-ProposalCanceled} event.
     */
    function cancel(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        bytes32 descriptionHash
    ) public returns (uint256) {
        return _cancel(targets, values, calldatas, descriptionHash);
    }

    /**
    * Return the current manager of the Governor contract
     */
    function getManager() public view returns (address) {
    	return _manager;
    }

    /**
    * Set a new manager to the governor contract
    *
    * @param _newManager New address to be the manager.
     */
    function setManager(address _newManager) onlyGovernance public {
    	_manager = _newManager;
    }

    /**
    * Resign from the manager role
    *
     */
    function resignAsManager() public {
        require(_msgSender() == _manager, "OtocoGovernor: Only manager itself could resign");
        _manager = address(0);
    }

    /**
    * Set a contract to be allowed or rejected to manager interact without require quorum
    *
    * @param contractAddress The contract address to be allowed.
    * @param allow A boolean value to represent allow/disallow.
     */
    function setAllowContract(address contractAddress, bool allow) onlyGovernance public {
    	require(contractAddress != address(this));
    	_allowedContracts[contractAddress] = allow;
    }

    /**
    * Check if a set of contract is allowed manager to interact
    *
    * @param targets Set of contracts to be verified.
    * @return boolean representing if all contracts are allowed
     */
    function isAllowedContracts(address[] calldata targets) public view returns (bool) {
        uint256 index = targets.length;
        while (index > 0) {
            if (!_allowedContracts[targets[index-1]]) return false;
            --index;
        }
        return true;
    }

    /**
    * Check if a proposal is a Manager Proposal
    *
    * @param proposalId The proposal ID to be verified
    * @return boolean is Manager Proposal
     */
    function isManagerProposal(uint256 proposalId) public view returns (bool) {
        return _managerProposal[proposalId];
    }
}
