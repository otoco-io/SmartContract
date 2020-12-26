# Otoco Smart-Contracts

[![Netlify Status](https://api.netlify.com/api/v1/badges/9d93e4b2-86e3-4bad-a5c4-dd1570f80680/deploy-status)](https://app.netlify.com/sites/upbeat-shaw-75fa27/deploys)

![thumb](https://user-images.githubusercontent.com/13040410/102030750-b10ef880-3d92-11eb-9041-edc18c9249ae.png)

## Features

- Gnosis-Safe Upgradeable deployer
- ERC20 Deployer
- Uses OpenZeppeling Upgradeable contracts
- Upgradeable plugins and Master Registry contract.

## Installation

Installing Ganache-cli (Local Ethereum Blockchain):

```sh
npm install -g ganache-cli
```

Installing Truffle + Mocha:

```sh
npm install -g truffle mocha
```

Installing dependencies:

```sh
npm install
```

Running ganache cli:

```sh
ganache-cli -p 8545
```

Running mocha tests:

```sh
truffle test
```

## Fluxogram for Creating and Managing Companies

![Otoco - Creation and Manage](https://user-images.githubusercontent.com/13040410/102531418-098b1200-4081-11eb-9f8e-8b85a41a2926.jpg)

### OtoCo Master Contracts - OtoCorp.sol

Responsible to receive payments and deploy new companies. Has a list of deployed Series.

**Master Delaware**: 0x24870e04F2573a132B695c48eB9ff2F3C8b0f410
**Master Wyoming**: 0x366e6a4e17875049670c9714CA33dC2F20cD1d37

#### Methods
- **constructor**: Sets `msg.sender` as the manager of the contract.
- **getBalance**: Gets the balance of the contract.
- **withdraw**: Transfers the balance to the manager. (Only manager can do)
- **createSeries**: Pay selected fee in (token) selected to create a Series(Contract) and set its name, symbol, total shares. Records its address to series array and a hashtable to the creator(`msg.sender`).
- **getMySeries**: Get an address array of all my series.


### Series - Series.sol
The Company itself. Represents a legal bind between a jurisdiction and a Company in ethereum.

#### Methods
- **constructor**: Sets some attribute to initialize a Series.
- **getName**: Get series name.
- **owner**: Get series current owner.

### Master Registry (Otoco Ledger) - MasterRegistry.sol
Here remains the additional data for Series. It is separated in Three mappings:

- **plugins**: Mapping of plugins used by Otoco to legally bind different plugins to Series. They are defined by Otoco itself allowing series Owners to add to their respective company.
- **records**: Mapping of different plugins(address) that a company has. They are defined by an Index(uint8) and only the Series owner are allowed to change its values after initialized. If isn't initialized, plugins itself are allowed to modify values for their respective index.
- **contents**: Mapping of different text values that coul be set to a company. Also defined by Indexes(uint8) and only series owners are allowed to change those values on behalf of a Company.

#### Methods

- **setPluginController**: Set a plugin that control a specific plugin index. This is only set by the owner og Master Registry.
- **setRecord**: Set new records on behalf of a Series contract, only Series owner, the own address or the plugin contract could change the entries. This record is referenced by index and represents a contract of the type of plugin.
- **getRecord**: Get record on behalf of a Series contract. This record is referenced by index and represents a contract.
- **setContent**: Set new records on behalf of a Series contract, only Series owner or the own address could change the entries. This record is referenced by index and represents a string.
- **getContent**: Get record on behalf of a Series contract. This record is referenced by index and represents a contract.

### Token Factory (plugin)
Deploys tokens on behalf of a Company. It not exactly represents shares of the company. Could represent anything that owners desires.

#### Methods

- **updateTokenContract**: Update the contract as reference to clone. Only Token Factory owner could update call this function.
- **createERC20**: Deploy a new ERC20 token on behalf of a series. Only series owner could deploy a new token. This function automatically creates an entry at Master Registry.

### Multisig Factory (plugin)
Deploy multisig contracts on behalf of Series, having the first key the owner of the Series. This factory has only permission to set a new Multisig, on behalf of the Series, in case of the Master Registry has already no wallets set for that specific Company.

**Current Proxy Factory owned by Gnosis**: 0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B

**Current Master Copy Reference**: 0x34cfac646f301356faa8b21e94227e3583fe3f5f

#### Methods

- **updateGnosisMasterCopy**: Update the contract as reference to clone. Only Multisig Factory owner could update call this function.
-**createMultisig**: Deploy a new GnosisSafe contract based on [parameters](https://docs.gnosis.io/safe/docs/contracts_deployment/). Only Series owners could deploy a Multisig wallet on behalf of a Series.

## References:

[Gnosis-Safe Docs](https://gnosis-safe.readthedocs.io/_/downloads/en/v1.0.0/pdf/)

[Upgradable Gnosis-safe app](https://docs.openzeppelin.com/contracts/3.x/upgradeable)

[Solidity DelegateProxy Contracts](https://blog.gnosis.pm/solidity-delegateproxy-contracts-e09957d0f201)

[Generating Payload for Gnosis-Safe transactions](https://ethereum.stackexchange.com/questions/82981/how-to-generate-data-payload-for-a-smart-contract-transaction-programmatically)

[List of transactions by address using Etherscan API](http://api.etherscan.io/api?module=account&action=tokentx&address=0x9f7dd5ea934d188a599567ee104e97fa46cb4496&startblock=0&endblock=999999999&sort=asc&apikey=YourApiKeyToken)