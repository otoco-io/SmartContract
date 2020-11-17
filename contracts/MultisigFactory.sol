// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import "./utils/GnosisSafeProxy.sol";

contract MultisigFactory is Initializable, OwnableUpgradeable {

    event MultisigCreated(address indexed series, address value);

    address private _gnosisMasterCopy; 

    modifier onlySeriesOwner(address _series) {
        require(OwnableUpgradeable(_series).owner() == _msgSender(), "Error: Only Series Owner could deploy tokens");
        _;
    }

    function initialize(address masterCopy) external {
        __Ownable_init();
        _gnosisMasterCopy = masterCopy;
    }

    function updateGnosisMasterCopy(address newAddress) onlyOwner public {
        _gnosisMasterCopy = newAddress;
    }
    
    function createMultisig(address _series, bytes memory data) onlySeriesOwner(_series) public {
        GnosisSafeProxy proxy = new GnosisSafeProxy(_gnosisMasterCopy);
        if (data.length > 0)
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                if eq(call(gas(), proxy, 0, add(data, 0x20), mload(data), 0, 0), 0) { revert(0,0) }
            }
        emit MultisigCreated(_series, address(proxy));
    }
}