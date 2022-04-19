# Otoco Smart-Contracts

[![Netlify Status](https://api.netlify.com/api/v1/badges/9d93e4b2-86e3-4bad-a5c4-dd1570f80680/deploy-status)](https://app.netlify.com/sites/upbeat-shaw-75fa27/deploys)

![thumb](https://user-images.githubusercontent.com/13040410/102030750-b10ef880-3d92-11eb-9041-edc18c9249ae.png)

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

## Benefits

- Reduced cost to deploy entities.
- Single transaction to create companies.
- Simple way to calculate amount to be paid in service fees.
- NFT integration with wallets.
- Simplified plugin structure becomes cheaper.
- Reduce third-party sevices required to run dapp.

## Fluxogram for Creating and Managing Companies

![OtoCo - Smart-Contract Redesign](https://user-images.githubusercontent.com/13040410/162950693-46daae94-8475-4f90-aa47-651021df9016.png)

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



### OtoCo Plugin - OtoCoPlugin.sol

The OtoCo Plugins are reworked and simplified. Not require to link a Registry to fetch their informations. Basically all plugins has its own initializers.

- **otocoMaster**: reference to the OtoCoMaster contract to transfer ETH paid for services.

#### Methods

- **isSeriesOwner** - Check if the caller is the controller of the entity to allow modification.
- **addPlugin** - Add the plugin to the entity selected according to the parameters selected.

## References:

[Gnosis-Safe Docs](https://gnosis-safe.readthedocs.io/_/downloads/en/v1.0.0/pdf/)

[Upgradable Gnosis-safe app](https://docs.openzeppelin.com/contracts/3.x/upgradeable)

[Solidity DelegateProxy Contracts](https://blog.gnosis.pm/solidity-delegateproxy-contracts-e09957d0f201)

