# Otoco Smart-Contracts

## Features


- Upgradeable plugins and Master Registry contract.

### OtoCo Master Contracts
Responsible to receive payments and deploy new companies. Has a list of deployed Series.

#### Methods
- **constructor**: Sets `msg.sender` as the manager of the contract.
- **getBalance**: Gets the balance of the contract.
- **withdraw**: Transfers the balance to the manager. (Only manager can do)
- **createSeries**: Pay selected fee in (token) selected to create a Series(Contract) and set its name, symbol, total shares. Records its address to series array and a hashtable to the creator(`msg.sender`).
- **getMySeries**: Get an address array of all my series.

**Master Delaware**: 0x24870e04F2573a132B695c48eB9ff2F3C8b0f410
**Master Wyoming**: 0x366e6a4e17875049670c9714CA33dC2F20cD1d37

### Series
The Company itself. Represents a legal bind between a jurisdiction and a Company in ethereum.

#### Methods
- **constructor**: Sets some attribute to initialize a Series.
- **getName**: Get series name.
- **owner**: Get series current owner.

### Master Registry (Otoco Ledger)
Here remains the additional data for Series. It is separated in Three mappings:

- **plugins**: Mapping of plugins used by Otoco to legally bind different plugins to Series. They are defined by Otoco itself allowing series Owners to add to their respective company.
- **records**: Mapping of different plugins(address) that a company has. They are defined by an Index(uint8) and only the Series owner are allowed to change its values after initialized. If isn't initialized, plugins itself are allowed to modify values for their respective index.
- **contents**: Mapping of different text values that coul be set to a company. Also defined by Indexes(uint8) and only series owners are allowed to change those values on behalf of a Company.

### Token Factory (plugin)
Deploys tokens on behalf of a Company. It not exactly represents shares of the company. Could represent anything that owners desires.

### Multisig Factory (plugin)
Deploy multisig contracts on behalf of Series, having the first key the owner of the Series. This factory has only permission to set a new Multisig, on behalf of the Series, in case of the Master Registry has already no wallets set for that specific Company.

**Current Proxy Factory owned by Gnosis**: 0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B

**Current Master Copy Reference**: 0x34cfac646f301356faa8b21e94227e3583fe3f5f

Multisig Truffle Console Test:
```js
 let accounts = await web3.eth.getAccounts()
// Get Master contract
let master = await MasterContract.at('Master address previously deployed');
// Deploy one series
master.CreateSeries('Teste', {from:accounts[1]})
// Store my series address to a variable
let myseries = await master.mySeries({from:accounts[1]})
// Create hex parameters to setup Gnosis-safe
let setupParametersEncoded = web3.eth.abi.encodeFunctionCall(GnosisSafe.abi[36], [[accounts[1]], 1, '0x0000000000000000000000000000000000000000', '0x0', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', 0, '0x0000000000000000000000000000000000000000']);
// Get multisig factory instance
const factory = await MultisigFactory.deployed();
// Create Gnosis safe wallet
factory.createProxy(myseries, setupParametersEncoded, {from:accounts[1]});
// Get my wallet from factory
let myGnosisSafe = await factory.safes(myseries);
```

## References:

[Gnosis-Safe Docs](https://gnosis-safe.readthedocs.io/_/downloads/en/v1.0.0/pdf/)

[Upgradable Gnosis-safe app](https://blog.openzeppelin.com/upgrades-app-for-gnosis-safe/)

[Solidity DelegateProxy Contracts](https://blog.gnosis.pm/solidity-delegateproxy-contracts-e09957d0f201)

[Generating Payload for Gnosis-Safe transactions](https://ethereum.stackexchange.com/questions/82981/how-to-generate-data-payload-for-a-smart-contract-transaction-programmatically)