// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./utils/IOwnable.sol";
import "./utils/GnosisSafeProxy.sol";

contract MultisigFactory is Ownable {

    mapping(address => address) public safes;
    address private _gnosisMasterCopy; 

    function updateGnosisMasterCopy(address newAddress) onlyOwner public {
        _gnosisMasterCopy = newAddress;
    }
    
    modifier onlySeriesOwner(address _series) {
        require(IOwnable(_series).owner() == _msgSender(), "Error: Only Series Owner could deploy tokens");
        _;
    }
    
    function createProxy(address _series, bytes memory data) onlySeriesOwner(_series) public {
        GnosisSafeProxy proxy = new GnosisSafeProxy(_gnosisMasterCopy);
        if (data.length > 0)
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                if eq(call(gas(), proxy, 0, add(data, 0x20), mload(data), 0, 0), 0) { revert(0,0) }
            }
        safes[_series] = address(proxy);
    }
}