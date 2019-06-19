pragma solidity ^0.5.0;

contract OtoCorpLLC {
  address payable public manager;
  address payable[] public series;
  mapping (address => address[]) public series_of;

  /// @dev This is the initialization function, here we just mark
  /// ourselves as the General Manager for this series organization.
  constructor() public {
      manager = msg.sender;
  }

  /// @dev This modifier is used to check if the user is the GM.
  modifier ifManager {
      if (msg.sender != manager)
          revert("Sender Not Contract Creator");

      _;
  }

  function getBalance() public view returns (uint) {
    return address(this).balance;
  }

  function withdraw() public ifManager {
    manager.transfer(address(this).balance);
  }

  function createSeries(string memory seriesName, string memory seriesSymbol, uint initTotalShares) public payable {
    if (msg.value != 0.1 ether)
      revert("Need 0.1 Eth for setting value.");
    Series newContract = new Series(msg.sender, seriesName, seriesSymbol, initTotalShares);
    series_of[msg.sender].push(address(newContract));
  }

  function getMySeries() public view returns (address[] memory) {
    return series_of[msg.sender];
  }
}

contract Series {

  string public name;
  string public symbol;
  uint public totalShares;

  struct Member {
      string name; // Legal name of memeber
      address payable addr; // Legal identification of the member
      uint shares; //Amount of shares, 0 being not a member/ex-member
      bool isManager; // This is legal: If this is "true", the partner is a Manager, if this is false, the partner is a normal member
      //uint amount; //Total amount of ether contributed by this user
  }

  address payable public creator;
  mapping (address => Member) public members;

  modifier ifManager {
      if (members[msg.sender].isManager == false)
          revert("Not a manager.");

      _;
  }

  constructor(
    address payable creator_addr,
    string memory newName,
    string memory newSymbol,
    uint initTotalShares
  ) public {
    name = newName;
    symbol = newSymbol;
    totalShares = initTotalShares;
    members[creator_addr] = Member("", creator_addr, initTotalShares, true);
    creator = creator_addr;
  }

  function getCreator() public view returns (address) {
    return creator;
  }

  function setMember(address payable addr, bool isManager) public ifManager {
    members[addr] = Member("", addr, 0, isManager);
  }
}
