# Otoco Smart-Contracts

[![Netlify Status](https://api.netlify.com/api/v1/badges/9d93e4b2-86e3-4bad-a5c4-dd1570f80680/deploy-status)](https://app.netlify.com/sites/upbeat-shaw-75fa27/deploys)

![thumb](https://user-images.githubusercontent.com/13040410/102030750-b10ef880-3d92-11eb-9041-edc18c9249ae.png)

## Installation

Install project packages:

```sh
npm install
```

Running Hardhat tests:

```sh
npx hardhat test
```

Running Code Coverage tests:

```sh
npx hardhat coverage
```

## Previous approach

The current approach of the project has multiple inefficient solutions.
At the moment of OtoCo conception it makes sense but due to increased demand of gas at Ethereum, we are required to drastically change our approach to make Dapp feasible to work on mainnet.

## Problems with previous approach

- Charging for spin-up usually requires the user to exchange their ETH for DAI before proceeding with approval step during spin-up.
- The DAI approval and transfer steps cost at least 90K additional gas for the user.
- Multiple bugs happen on different wallets during the approval step. New users also doesn't not comprehend very well that the approval step doesn't transfer the tokens, only approve for the deployer to consume them after. 
- The activation phase that creates the new entity instantiates a new contract on the blockchain. It required an absurd amount of 300K gas for a simple Ownable contract.
- Entity > Ownership relation couldn't be tracked by the Master smart-contract requiring us to rely on third party services like TheGraph to keep tracking Series and his Owner.
- Having multiple Master contracts sometimes confuses users that don't recognize those different contracts for each jurisdiction.
- Master Registry create a unecessary complexity requiring different structures to store different plugins.

## Solutions

- The first decision was get rid of DAI payment since that make so much friction to the process.
- We also decide to charge a percentage of fees in ETH during creation. We are targeting entity creation at 80k in gas. So for a 50gwei gas price a company creation would cost 20USD at max (ETH at 3.500 USD).
- Based on multiple projects around like ENS, KaliDAO and The Graph that uses ERC721 to define ownership, we decided to switch our Ownables contracts to a single ERC721 contract to define ownership of entities making simpler to list the this entities owned by a single address, without requiring a third-party service.
- Otoco values paid for plugins are transferred to OtoCoMaster instantly requiring a single transaction to withdraw all values paid for company creation and plugins.
- Get rid of Master Registry contract, now entity owners call directly the plugins they want to add to their company. The informations are stored directly on plugin storage.
- Allow add and tweak jurisdictions without require upgrade Master contract.

## Features

### Rules:
- **ADMINISTRATOR**: Master contract owner.
- **USER**: Dapp user.
- **MAINTAINER**: The Plugin contract owner.

### OtoCo Jurisdiction

- Unique contracts that hold information related to one specific jurisdiction.
- Pre-existent jurisdiction has to be deployed before the master.
- Return the name formatting according to the requirements of the jurisdiction.
- Return badges(NFT Images) related to the jurisdiction.
- Has 2 different badges, the Default and the gold badge. The gold one is for the series created before migration.
- For unincorporated entities there's no change in the names, for DE entities a " LLC" suffix is added to the name of new series and for WY a " - Series ##" suffix is added to the name. 

### OtoCo Master

- The contract is created passing the pre-existent jurisdictions addresses.
- The contract has a function to migrate all previous entities (DE, WY and Unincorporated) as new ERC721 tokens in chronological order.
- The migration function has to be called multiple times due to high consumption of gas that surpasses the max size of the blocks. 
Once migration completes, a flag is set defining the last migrated entity. For all migrated entities a Gold badge is fetched when NFT info is returned.
- Allow USER to create an entity in a single transaction passing 10% of transaction fees in ETH.
- At the moment of creation a USER could create a Series on behalf of ANY address.
- Allow USER to close a LLC that he owns passing 10% of fees in ETH to transaction value.
- Retain value paid for creation/closing of series for all jurisdictions, even Unincorporated.
- Allow ANYONE to request tokenURI(badges)
- Allow ANYONE to list user owned entities based on "transfer" events + token ownership.
- The name formatting for the series happens at the moment of creation.
- Jurisdiction addresses(contracts) could be added and updated by the ADMINISTRATOR not requiring a redeployed master.
- Base fees(10%) could be changed by the ADMINISTRATOR.
- Fees withdrawn could be requested by the ADMINISTRATOR.

### OtoCo Plugin

- Transfer payments to OtoCoMaster before add/attach/remove plugins.
- Plugins will always request the OtoCoMaster the current baseFees to add/attach/remove.
- Do not transfer any value in cases where baseFees are 0, or msg.sender is the OtoCoMaster(In future implementation where OtoCoMaster will create LLC along with plugins).
- Only allow USER to add/attach/remove plugins to a series that he controls.
- Plugins could have more functions but it is obligatory to MAINTAINER declare the add/attach/remove functions.
- MAINTAINER could tweak some parameters of the plugin but not the BaseFees(that is requested to OtoCoMaster) or change the OtoCoMaster reference during maintainance. 

## Fluxogram for Creating and Managing Companies

![OtoCo - Smart-Contract Redesign](https://user-images.githubusercontent.com/13040410/164290477-567196f7-eb5d-4b76-9290-2d9a8a4f3ad3.png)

### OtoCo Master - OtoCoMaster.sol

Responsible to receive payments and deploy new companies. Has a list of deployed Series.

- **seriesCount**: Total count of series.
- **series**: Mapping of the series created, each of them are structs with the following properties: (uint16)jurisdiction, (uint16)entityType, (uint64)creation, (string)name.
- **jurisdictionCount**: The number of differrent jurisdictions.
- **jurisdictionsAddress**: A mapping to point jurisdiction addresses that are OtocoJurisdiction contracts, with their own rules to name entities and NFT URIs.
- **baseFee**: Base fees charged for company deployment and plugins attach/removal.

#### Administration Methods
- **initialize**: Initialize the contract and create initial jurisdictions.
- **createBatchSeries**: Function to Migrate previous entities.
- **changeBaseFees**: Set the new base fees divider to be paid in ETH along with the Dapp transactions.
- **addJurisdiction**: Add a new jurisdiction to the network.
- **updateJurisdiction**: Update a pre-existing jurisdiction to the network.
- **withdrawFees**: Withdraw the ETH stored on the contract.

#### Public Methods
- **createSeries**: Create a new entity and set his controller. To create a new series is required to set the (uint16)jurisdiction, (string)name and the (address)controller of the entity.
- **closeSeries**: Close the desired series. Cold only be called by the controller of the entity.
- **tokenURI**: Return the JSON URI of the desired entity index.


### OtoCo Jurisdiction - OtoCoJurisdiction.sol

Contract with series name rules definition and the TokenURI badges related to it. Used to add new jurisdiction with their own naming rules to Master without requiring to upgrade master contract.

#### Public Methods

- **getSeriesNameFormatted**: Format the series name to the requirements of the jurisdiction.
- **getJurisdictionName**: Return the name of the jurisdiction.
- **getJurisdictionBadge**: Return the default badge URI for the Jurisdiction.
- **getJurisdictionGoldBadge**: Return the gold badge URI for the Jurisdiction.

### OtoCo Plugin - OtoCoPlugin.sol

The OtoCo Plugins are reworked and simplified. Not require to link a Registry to fetch their informations. Basically all plugins has its own initializers.

- **otocoMaster**: reference to the OtoCoMaster contract to transfer ETH paid for services.

#### Methods

- **isSeriesOwner** - Check if the caller is the controller of the entity to allow modification.
- **addPlugin** - Add the plugin to the entity selected according to the parameters selected.
- **attachPlugin** - Attach a pre-existing plugin to the entity.
- **removePlugin** - Add the plugin to the entity selected according to the parameters selected.

## References:

[Batch Minting NFTs](https://blog.alchemy.com/blog/erc721-vs-erc721a-batch-minting-nfts)

[Open-Zeppelin ERC721](https://docs.openzeppelin.com/contracts/2.x/api/token/erc721)

[Open-Zeppelin Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/1.x/hardhat-upgrades)

[Gnosis-Safe Contracts](https://github.com/safe-global/safe-contracts/tree/v1.3.0-libs.0)

[Gnosis-safe Proxy Factory](https://etherscan.io/address/0xa6b71e26c5e0845f74c812102ca7114b6a896ab2#code)

[ENS Registry](https://docs.ens.domains/contract-api-reference/ens)

[ENS Deploy a FIFS Registrar](https://docs.ens.domains/deploying-ens-on-a-private-chain#deploy-a-registrar)

[OtoGo Launchpool Repo](https://github.com/otoco-io/OtoGo-SmartContracts)

[OtoCo Frontend-Repo](https://github.com/otoco-io/OtoCo-Gatsby)