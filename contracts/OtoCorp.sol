// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Series.sol";

contract OtoCorp is Ownable {
    
    uint256 private tknSeriesFee;
    IERC20 private tkn;
    mapping(address=>address[]) seriesOfMembers;
    
    event TokenAddrChanged(address _oldTknAddr, address _newTknAddr);
    event ReceiveTokenFrom(address src, uint256 val);
    event NewSeriesCreated(address _contract, address _owner, string _name);
    event SeriesFeeChanged(uint256 _oldFee, uint256 _newFee);
    event TokenWithdrawn(address _owner, uint256 _total);
    
    constructor(IERC20 _tkn) public {
        tkn = _tkn;
        tknSeriesFee = 0**18;
    }
    
    function withdrawTkn() external onlyOwner {
        require(tkn.transfer(owner(), balanceTkn()));
        emit TokenWithdrawn(owner(), balanceTkn());
    }
    
    function createSeries(string memory seriesName) public payable {
        require(tkn.transferFrom(msg.sender, address(this), tknSeriesFee));
        emit ReceiveTokenFrom(msg.sender, tknSeriesFee);
        Series newContract = new Series(seriesName);
        seriesOfMembers[msg.sender].push(address(newContract));
        newContract.transferOwnership(msg.sender);
        emit NewSeriesCreated(address(newContract), newContract.owner(), newContract.getName());
    }
    
    function changeTknAddr(IERC20 newTkn) external onlyOwner {
        address oldTknAddr = address(tkn);
        tkn = newTkn;
        emit TokenAddrChanged(oldTknAddr, address(tkn));
    }
    
    function changeSeriesFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = tknSeriesFee;
        tknSeriesFee = _newFee;
        emit SeriesFeeChanged(oldFee, tknSeriesFee);
    }
    
    function balanceTkn() public view returns (uint256){
        return tkn.balanceOf(address(this));
    }
    
    function isUnlockTkn() public view returns (bool){
        return tkn.allowance(msg.sender, address(this)) > 0;
    }
    
    function mySeries() public view returns (address[] memory) {
        return seriesOfMembers[msg.sender];
    }
    
}