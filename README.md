# (POC 02) Series Factory with ERC20 Token Payment - 2019/09
It is verifying how can we receive ERC20 Token then create the series contract for Payer. 
- **ERC20_Version/OtoCorp.sol**
- **ERC20_Version/Series.sol**
---

# DAI Payment POC
- **SimpleDAIReceiver.sol**
- It' a small test for receiving DAI.
- First, We use User to approve correct DAI amount to the Conotract (price).
- Then we can call our contract function to receive DAI (Received DAI belongs to our contract not owner).
- We can use contract owner to withdraw DAI. (After this step DAI belongs to owner) 
- Tested on Remix already.
- Default DAI Address is on Kovan test network.
- We will update features description next commit. (Maybe)
---

# POC 01
It is verifying how we can build the contract for some idea. 
e.g. create a contract via a contract.

---

## Features
There are two contracts in the sol file.
It seems some simple interaction, but can help us to understand how we can implement and what service we might need.
### OtoCorpLLC
- **constructor**: Sets `msg.sender` as the manager of the contract.
- **getBalance**: Gets the balance of the contract.
- **withdraw**: Transfers the balance to the manager. (Only manager can do)
- **createSeries**: Pay 0.1 ETH to create a Series(Contract) and set its name, symbol, total shares. Records its address to series array and a hashtable to the creator(`msg.sender`).
- **getMySeries**: Get an address array of all my series.

### Series
- **constructor**: Sets some attribute to initialize a Series.
- **getCreator**: Get creator address.
- **setMember**: Set a member.

## Main-net Deploys

**Delaware**: 0x24870e04F2573a132B695c48eB9ff2F3C8b0f410
**Wyoming**: 0x366e6a4e17875049670c9714CA33dC2F20cD1d37