# Otoco Smart-Contracts

[![Netlify Status](https://api.netlify.com/api/v1/badges/9d93e4b2-86e3-4bad-a5c4-dd1570f80680/deploy-status)](https://app.netlify.com/sites/upbeat-shaw-75fa27/deploys)

![thumb](https://user-images.githubusercontent.com/13040410/102030750-b10ef880-3d92-11eb-9041-edc18c9249ae.png)

## INSTALLATION

Install project packages:

```sh
npm install
```

Running Hardhat tests:

```sh
npx hardhat test
```

Running code coverage tests:

```sh
npx hardhat coverage
```

Deploy local contracts:
```
npx hardhat run --network localhost scripts/1-deploy-jurisdictions.js
npx hardhat run --network localhost scripts/2-deploy-master.js
npx hardhat run --network localhost scripts/10-deploy-plugin-timestamp.js
npx hardhat run --network localhost scripts/11-deploy-token-plugin.js
npx hardhat run --network localhost scripts/12-deploy-multisig-plugin.js
npx hardhat run --network localhost scripts/13-deploy-launchpool-plugin.js
npx hardhat run --network localhost scripts/14-deploy-ens-plugin.js
npx hardhat run --network localhost scripts/15-deploy-payment-tokens.js
npx hardhat run --network localhost scripts/17-deploy-tokenization.js
```

## DOCUMENTATION

### 1. Previous Approach

The previous approach of the project has multiple inefficient solutions.
At the moment of OtoCo conception it makes sense but due to increased demand of gas at Ethereum, we are required to drastically change our approach to make Dapp feasible to work on mainnet.

#### 1.1 Problems with previous approach

- Charging for spin-up usually requires the user to exchange their ETH for DAI before proceeding with approval step during spin-up.
- The DAI approval and transfer steps cost at least 90K additional gas for the user.
- Multiple bugs happen on different wallets during the approval step. New users also doesn't not comprehend very well that the approval step doesn't transfer the tokens, only approve for the deployer to consume them after.
- The activation phase that creates the new entity instantiates a new contract on the blockchain. It required an absurd amount of 300K gas for a simple Ownable contract.
- Entity > Ownership relation couldn't be tracked by the Master smart-contract requiring us to rely on third party services like TheGraph to keep tracking Series and his Owner.
- Having multiple Master contracts sometimes confuses users that don't recognize those different contracts for each jurisdiction.
- Master Registry create a unecessary complexity requiring different structures to store different plugins.

#### 1.2 Solutions

- The first decision was get rid of DAI payment since that make so much friction to the process.
- We also decide to charge a percentage of fees in ETH during creation. We are targeting entity creation at 100k in gas. So for a 50gwei gas price a company creation would cost 15USD at max (ETH at 3.000 USD).
- Based on multiple projects around like ENS, KaliDAO and The Graph that uses ERC721 to define ownership, we decided to switch our Ownables contracts to a single ERC721 contract to define ownership of entities making simpler to list the this entities owned by a single address, without requiring a third-party service.
- Otoco values paid for plugins are transferred to OtoCoMaster instantly requiring a single transaction to withdraw all values paid for company creation and plugins.
- Get rid of Master Registry contract, now entity owners call directly the plugins they want to add to their company. The informations are stored directly on plugin storage.
- Allow add and tweak jurisdictions without require upgrade Master contract.

### 2. Features

- **ADMINISTRATOR**: Master contract owner.
- **USER**: Dapp user.
- **MAINTAINER**: The Plugin contract owner.

#### 2.1 OtoCo Jurisdiction

- Unique contracts that hold information related to one specific jurisdiction.
- Pre-existent jurisdiction has to be deployed before the master.
- Return the name formatting according to the requirements of the jurisdiction.
- Return badges(NFT Images) related to the jurisdiction.
- Has 2 different badges, the Default and the gold badge. The gold one is for the series created before migration.
- For unincorporated entities there's no change in the names, for DE entities a " LLC" suffix is added to the name of new series and for WY a " - Series ##" suffix is added to the name.

#### 2.2 OtoCo Master Features

- The contract is created passing the pre-existent jurisdictions addresses.
- The contract has a function to migrate all previous entities (DE, WY and Unincorporated) as new ERC721 tokens in chronological order.
- The migration function has to be called multiple times due to high consumption of gas that surpasses the max size of the blocks.
  Once migration completes, a flag is set defining the last migrated entity. For all migrated entities a Gold badge is fetched when NFT info is returned.
- Allow USER to create an entity in a single transaction passing the OtoCoFee(10% for Ethereum Mainnet) of transaction fees in ETH.
- At the moment of creation a USER could create a Series on behalf of ANY address.
- Allow USER to close a LLC that he owns passing OtoCoFee(10% for Ethereum Mainnet) in ETH to transaction value.
- Retain value paid for creation/closing of series for all jurisdictions, even Unincorporated.
- Allow ANYONE to request tokenURI(badges)
- Allow ANYONE to list user owned entities based on "transfer" events + token ownership.
- The name formatting for the series happens at the moment of creation, based on Jurisdiction rules.
- Jurisdiction addresses(contracts) could be added and updated by the ADMINISTRATOR not requiring a redeployed master.
- Base fees OtoCoFee(10% for Ethereum Mainnet) could be changed by the ADMINISTRATOR.
- Fees withdrawn could be requested by the ADMINISTRATOR.

#### 2.3 OtoCo Plugin Features

- Transfer payments to OtoCoMaster before add/attach/remove plugins.
- Plugins will always request the OtoCoMaster the current baseFees to add/attach/remove.
- Do not transfer any value in cases where baseFees are 0, or msg.sender is the OtoCoMaster(In future implementation where OtoCoMaster will create LLC along with plugins).
- Only allow USER to add/attach/remove plugins to a series that he controls.
- Plugins could have more functions but it is obligatory to MAINTAINER declare the add/attach/remove functions.
- MAINTAINER could tweak some parameters of the plugin but not the BaseFees(that is requested to OtoCoMaster) or change the OtoCoMaster reference during maintainance.

### 3. Implementation

![OtoCo - Smart-Contract Redesign](https://user-images.githubusercontent.com/13040410/164290477-567196f7-eb5d-4b76-9290-2d9a8a4f3ad3.png)

#### 3.1 OtoCoJurisdiction.sol

Contract with series name rules definition and the TokenURI badges related to it. Used to add new jurisdiction with their own naming rules to Master without requiring to upgrade master contract.

###### Public Methods

- **getSeriesNameFormatted(uint256 count, string name)**: Format the series name to the requirements of the jurisdiction. Receive current series count and return name formatted.
- **getJurisdictionName()**: Return the name of the jurisdiction.
- **getJurisdictionBadge()**: Return the default badge URI for the Jurisdiction.
- **getJurisdictionGoldBadge()**: Return the gold badge URI for the Jurisdiction.

#### 3.2 OtoCoMaster.sol

Responsible to receive payments and deploy new companies. Contains a list of deployed Series as NFTs and its details.

###### Administration Methods (This methods are only called by the Manager of the contract)

- **initialize**: Initialize the implementation contract and create initial jurisdictions.
- **createBatchSeries**: Function to Migrate previous entities.
- **changeBaseFees**: Set the new base fees to be paid in ETH along with the Dapp transactions.
- **addJurisdiction**: Add a new jurisdiction to the network.
- **updateJurisdiction**: Update a pre-existing jurisdiction to the network.
- **withdrawFees**: Withdraw the ETH stored on the contract.

###### Public Methods

- **seriesCount()**: Return the total number of series joining all jurisdictions. 
- **series(uint256 tokenId)**: Mapping of the series created, each of them are structs with the following properties: `(uint16)jurisdiction`, `(uint16)entityType`, `(uint64)creation`, `(string)name`.
- **jurisdictionCount()**: Return the number jurisdiction registered at this Master.
- **jurisdictionsAddress(uint16 JurisdictionIndex)**: A mapping to point jurisdiction addresses that are OtocoJurisdiction contracts, with their own rules to name entities and NFT URIs.
- **baseFee()**: Base fees charged for company deployment/closing and plugins attach/removal. This amount is in percentage and represent a value in ETH that needs to be send along with transaction. To know exact amount to send along with transaction the calculation require is the following:

![OtoCo Fees = (GasLimit * GasPrice * OtoCoBaseFee) / 100](https://user-images.githubusercontent.com/13040410/174851118-d559ce80-9fba-456c-bf37-58b952f3da25.png)

- **createSeries(uint16 jurisdiction, address controller, string name)**: Create a new entity and set his controller. To create a new series is required to set the jurisdiction, name and the controller of the entity. GasLimit to send this transaction take into account if is the first entity created by the controller and the size of the name of the entity after jurisdiction modification requirements. It usually fluctuates between 130k and 250k gas.
- **closeSeries(uint256 tokenId)**: Close the desired series. Cold only be called by the controller of the entity. The gas limit required to close an entity is 50k gas.
- **tokenURI(uint256 tokenId)**: Return the JSON URI of the desired entity index. This is user to fetch ERC-721 metadata from tokens.

#### 3.3 OtoCoPlugin.sol

The OtoCo Plugins are reworked and simplified. Not require to link a Registry to fetch their informations. Basically all plugins has its own initializers.

To initialize a plugin a message should be encoded to pass parameters to `addPlugin`, `attachPlugin`, `removePlugin` function. For each different plugin you should check the specific parameters on [Plugins](#4-plugins).

How to encode `pluginData` parameters using Ethers:
```
let encoded = ethers.utils.defaultAbiCoder.encode(
  ['uint256', 'string', 'string', 'address'],
  [ethers.utils.parseEther('8000000'), 'Test Token', 'TTOK', wallet2.address]
);
```

###### Public Methods

- **otocoMaster()**: reference to the OtoCoMaster contract to transfer ETH paid for services. This function appears on all plugins, so it's possible to verify the correct OtoCo Master attachment.

- **addPlugin(uint256 tokenId, bytes pluginData)** - Add the plugin to the entity selected according to the parameters selected. To call this function is required to add a ETH value to transaction referent to OtoCo Fee related to the gas spend.
- **attachPlugin(uint256 tokenId, bytes pluginData)** - Attach a pre-existing plugin to the entity. To call this function is required to add a ETH value to transaction referent to OtoCo Fee related to the gas spend.
- **removePlugin(uint256 tokenId, bytes pluginData)** - Add the plugin to the entity selected according to the parameters selected. To call this function is required to add a ETH value to transaction referent to OtoCo Fee related to the gas spend.

### 4. Plugins

Here there are functions related to the possible functions to call and its required parameters.

#### 4.1 Timestamp

- **DocumentTimestamped(uint256 indexed seriesId, uint256 timestamp, string filename, string cid)** - Fetch this events to check specific entity timestamps.

- **addPlugin(uint256 tokenId, bytes pluginData)** - Attach a timestamped document CID to a series. `pluginData` parameters: `[string, string]` that represent `fileCID` and `filename`. `gasLimit` recommended to use is 50k gas.

#### 4.2 Token

- **tokenContract()** - Returns the token implementation that serves as source to clone to deploy new tokens.
- **tokensPerEntity(uint256 tokenId)** - Return the current amount of tokens attached to the respective entity.
- **tokensDeployed(uint256 tokenId, uint256 index)** - Address of the token index respective to a specific entity.

- **addPlugin(uint256 tokenId, bytes pluginData)** - Deploy a new ERC-20 Token on behalf of the series. `pluginData` parameters: `[uint256,string,string,address]` that represent `totalSupply`, `name`, `symbol` and `holder`, being holder the address that will receive the total supply of the tokens after deployment. `gasLimit` recommended to use is 300k gas.
- **attachPlugin(uint256 tokenId, bytes pluginData)** - Attach a pre-existing token to the entity. `pluginData` parameters: `[address]` the address of the token to be attached. `gasLimit` recommended to use 130k.
- **removePlugin(uint256 tokenId, bytes pluginData)** - Remove a pre-existing token to the entity. `pluginData` parameters: `[uint256]` the index of the token to be removed. `gasLimit` recommended to use 70k.

#### 4.3 Multisig

- **gnosisMasterCopy()** - Returns the current mastercopy used by Gnosis Proxy Factory to deploy.
- **gnosisProxyFactory()** - Returns the current Gnosis Proxy Factory used to deploy new multisig wallets.

- **multisigPerEntity(uint256 tokenId)** - Return the current amount of multisig wallets attached to the respective entity.
- **multisigDeployed(uint256 tokenId, uint256 index)** - Address of the multisig wallet at given index respective to a specific entity.

- **addPlugin(uint256 tokenId, bytes pluginData)** - Deploy a new Gnosis-Safe Multisig on behalf of the series. `pluginData` parameters: `[address[],uint256,address,bytes,address,address,address,uint256,address]` that represent [Setup Parameters for Multisig](https://safe-docs.dev.gnosisdev.com/safe/docs/contracts_deployment/). `gasLimit` recommended to use is 400k gas.
- **attachPlugin(uint256 tokenId, bytes pluginData)** - Attach a pre-existing multisig to the entity. `pluginData` parameters: `[address]` the address of the multisig to be attached. `gasLimit` recommended to use 130k.

#### 4.4 Launchpool

- **launchpoolDeployed(uint256 tokenId)** - Returns the current launchpool assigned to an entity.

- **addPlugin(uint256 tokenId, bytes pluginData)** - Deploy a new OtoGo Launchpool on behalf of the series. `pluginData` parameters: `[ address[], uint256[], string, address, uint16,address]` that represent [Setup Parameters for Launchpool](https://github.com/otoco-io/OtoGo-SmartContracts#create-launch-pool-createlaunchpool). `gasLimit` recommended to use is 1000k gas.

#### 4.5 ENS

- **domainsPerEntity(uint256 tokenId)** - Return the current amount of domains attached to the respective entity.
- **seriesDomains(uint256 tokenId, uint256 index)** - return the subdomain name at given index respective to a specific entity.

- **addPlugin(uint256 tokenId, bytes pluginData)** - Assign a `otoco.eth` subdomain to the manager or multisig address associated to the entity. `pluginData` parameters: `[string, address]` that represent `subdomain` and `target`. Where subdomains is a simple string name and target should be a valid address to subdomain points to. `gasLimit` recommended to use is 250k gas.

#### 4.6 Tokenized LLC

A contract that allows LLC members to transform their LLC into a Tokenized LLC with a different Agreement that allow it to have multi owners and also a MANAGER that no need to have shares.

- PARTNERS: Accounts that have tokens shares from the entity.
- MANAGER: A manager that could interact with the Allowed contracts

Governor contract where Tokenized LLC resides is based on OpenZeppelin Governor. Here is the Governor base features:

 - Possibility to any PARTNER that have at least proposalThreshold(defaults to 1) tokens create a proposal. It means that any person with any amount of tokens bigger than 0 could propose.
 - Proposals have a votingDelay defined in blocks to be voted (defaults to 1).
 - Proposal have a votingPeriod defined in blocks to PARTNERS vote.
 - Proposals need a minimum quorum to pass (defaults to 4%)
 - A proposal could be executed after the votingPeriod ends, voting has enough quorum and vote FOR is bigger than votes AGAINST.
 - It is possible to vote using EIP-712 signatures.
 - The ERC20 token should have snapshot voting mechanism.
 - It is possible to propose a change to governance settings like voting delay, voting period and quorum required. 
- Votes could be casted with reason attached.

Here is a list of feature that OtoCoGovernor add:

- Set default quorum to 51%.
- Add a list of allowed contracts to interact.
- Add the MANAGER role to the governance.
- Manager could create any kind of proposal without requiring any token.
- Proposals created by the MANAGER that only deals with allowed contracts, is flagged as manager proposals.
- Proposals flagged as manager proposals not require any quorum, and if voter FOR is equals to votes AGAINST it will be considered valid. This means that nobody needs to vote, the MANAGER only need to wait for the votingPeriod finish to execute the proposal. If any partner decide to veto the proposal it could vote AGAINST. In those cases the validity of the proposal will be defined by the votes FOR and AGAINST.
- The MANAGER could be changed by a proposal.
- The allowed contracts could be changed(Added/Removed) by proposal.
- The MANAGER could resign as MANAGER without requiring a proposal.

Tokenization contract functions:

- **governorsDeployed(uint256 tokenId)** - Returns the current governor assigned to an entity.

- **addPlugin(uint256 tokenId, bytes pluginData)** - Deploy a new OtoCo Govenor on behalf of the series. `pluginData` parameters: `[ string, string, address[], address[], uint256[]]` that represent `name of the token`, `symbol of the token`, `allowed contracts array`, `addresses([0] manager address, [1] token source to be cloned, [2..n] partner addresses)`, `settings ([0] partners quantity, [1] Voting period in block, [2..n] member shares)`. `gasLimit` recommended to use is 1200k gas.

- **attachPlugin(uint256 tokenId, bytes pluginData)** - Deploy a new OtoCo Govenor using a pre-existent ERC20Votes token. `pluginData` parameters: `[ address[], address[], uint256[]]` that represent `allowed contract array, addresses([0] Manager address,[1] Token Address), settings([0] Members size, [1] Voting period in blocks)`. `gasLimit` recommended to use is 1000k gas.


### 5. Audit

In May 2022, OtoCo engaged Coinspect to perform a source code review of OtoCo Smart Contracts. The objective of the project was to evaluate the security of the smart contracts.

The documentation generated by this audit is present at `audit` folder.

### 6. Deployments

Ethereum Mainnet

| Name | Address | Explorer |
| - | - | - |
| OtoCo Master | `0x752B0073422A7F9Cda7f71B5fE7F12a1789e6506` | [link](https://etherscan.io/address/0x752B0073422A7F9Cda7f71B5fE7F12a1789e6506#code) |
| Timestamp Plugin | `0xaA6e8D5baB906B5d1F270f95d38e92d51a7a9C8A` | [link](https://etherscan.io/address/0xaA6e8D5baB906B5d1F270f95d38e92d51a7a9C8A#code)  |
| Token Plugin | `0x0650601Bc69e8BBf7Dc9ca0F032fB057135103e3` | [link](https://etherscan.io/address/0x0650601Bc69e8BBf7Dc9ca0F032fB057135103e3#code) |
| Multisig Plugin | `0xD9a0927345244F2c45511CFaA5bDD00db7a8decc` | [link](https://etherscan.io/address/0xD9a0927345244F2c45511CFaA5bDD00db7a8decc#code) |
| Launchpool Plugin | `0x1477E9f01B78Ec20405542e5ee07469a7c93c83e` | [link](https://etherscan.io/address/0x1477E9f01B78Ec20405542e5ee07469a7c93c83e#code) |
| ENS Plugin | `0x355894349219dccf4825B66b2f383877C77304c9` | [link](https://etherscan.io/address/0x355894349219dccf4825B66b2f383877C77304c9#code) |


Ethereum Testnet (Goerli)

| Name | Address | Explorer |
| - | - | - |
| OtoCo Master | `0x5B9aE6234Cf1E447680c245200E066091E631Bf3` | [link](https://goerli.etherscan.io/address/0x5B9aE6234Cf1E447680c245200E066091E631Bf3#code) |
| Timestamp Plugin | `0x0d3BC598F0F75590CD75D60D40e0510F515EBE51` | [link](https://goerli.etherscan.io/address/0x0d3BC598F0F75590CD75D60D40e0510F515EBE51#code) |
| Token Plugin | `0xbaAbb166463221ffE04Fd7F06262bD670e26F823` | [link](https://goerli.etherscan.io/address/0xbaAbb166463221ffE04Fd7F06262bD670e26F823#code) |
| Multisig Plugin | `0x6a4E318410521b97feA47c52E1ae3Ab0ca67335D` | [link](https://goerli.etherscan.io/address/0x6a4E318410521b97feA47c52E1ae3Ab0ca67335D#code) |
| Launchpool Plugin | `0x26b17999f109b3ee24Ef26a60495d5c583f3EE6f` | [link](https://goerli.etherscan.io/address/0x26b17999f109b3ee24Ef26a60495d5c583f3EE6f#code) |
| ENS Plugin | `0x58F6C99Ded465950cc06113Ca168404ec842B8c8` | [link](https://goerli.etherscan.io/address/0x58F6C99Ded465950cc06113Ca168404ec842B8c8#code) |

## REFERENCES

[Batch Minting NFTs](https://blog.alchemy.com/blog/erc721-vs-erc721a-batch-minting-nfts)

[Open-Zeppelin ERC721](https://docs.openzeppelin.com/contracts/2.x/api/token/erc721)

[Open-Zeppelin Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/1.x/hardhat-upgrades)

[Gnosis-Safe Contracts](https://github.com/safe-global/safe-contracts/tree/v1.3.0-libs.0)

[Gnosis-safe Proxy Factory](https://etherscan.io/address/0xa6b71e26c5e0845f74c812102ca7114b6a896ab2#code)

[ENS Registry](https://docs.ens.domains/contract-api-reference/ens)

[ENS Deploy a FIFS Registrar](https://docs.ens.domains/deploying-ens-on-a-private-chain#deploy-a-registrar)

[OtoGo Launchpool Repo](https://github.com/otoco-io/OtoGo-SmartContracts)

[OtoCo Frontend-Repo](https://github.com/otoco-io/OtoCo-Gatsby)
