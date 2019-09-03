pragma solidity ^0.5.0;

import "github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/ownership/Ownable.sol";
import "github.com/OpenZeppelin/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract SDR is Ownable {

    address DAIAddr = address(0xC4375B7De8af5a38a93548eb8453a498222C4fF2);
    uint256 price = 0.01*(10**18);

    event ReceiveDAIFrom(address src, uint256 val);
    event DAIAddrChanged(address oldA, address newA);

    function balanceDAI() public view returns (uint256){
        return IERC20(DAIAddr).balanceOf(address(this));
    }

    function withdrawDAI() external onlyOwner {
        require(IERC20(DAIAddr).transfer(owner(), balanceDAI()));
    }

    function receiveDAI(address src) external onlyOwner {
        require(IERC20(DAIAddr).transferFrom(src, address(this), price));
        emit ReceiveDAIFrom(src, price);
    }

    function changeDAIAddr(address a) external onlyOwner {
        address OldA = DAIAddr;
        DAIAddr = a;
        emit DAIAddrChanged(OldA, DAIAddr);
    }

    function allowanceDAI(address src) public view returns (uint256){
        return IERC20(DAIAddr).allowance(src, address(this));
    }

}