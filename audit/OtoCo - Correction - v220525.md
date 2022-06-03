## CORRECTIONS RELATED TO Otoco - Smart Contract Audit v220524

### COMMIT

The commit related to the corrections is: `98f3589b012b78f74b047f22d51595479790b5b7`

We recommend run tests using command: ```npx hardhat coverage```

### ASSESSMENT

Coinspect found that if the number of jurisdictions surpasses 255, the OtoCoMaster contract can no longer mint series in batch mode and always causes a revert of the transaction (**OGO-9**).

The OtoCoToken contract can be taken over by an attacker by front-running the initialization process (**OGO-10**). The impact of this issue was diminished as medium risk, because the OtoCoToken contract is only created via the Token plugin contract that always initializes the contract after cloning it.

Regarding low risk issues, it was found that some variables declared in the OtoCoToken contract shadow variables in the parent ERC20 contract. This causes different variables to be used in the parent and inherited contract (**OGO-11**).

Another low risk issue was found where the contract owner can batch mint series with a timestamp in the past or the future (**OGO-12**).

Also, the function `createBatchSeries()` in the `OtoCoMaster` contract iterates over all the jurisdictions, and if the number of jurisdictions is high the cost of transactions can be rendered prohibitive (**OGO-13**).

Some informative issues are also reported, concerning documentation and validations, that do not represent security problems (**OGO-14**, **OGO-15**).

Finally, we found the included tests to have a reasonable coverage of the contracts code and functionality.

### ISSUES

**OGO-9** - Integer overflow in function createBatchSeries

Resolved as recommended removing changing `i` variable type to `uint16`

**OGO-10** - Improper initialization of token contract

Resolved as recommended inheriting OpenZeppeling `Initializable` contract and using `Initializable` modifier on `constructor` (as recommended on `Initializable.sol`). Also added a modifier `initializer` at `initialize` function and `removed` the previous modifier `NotInitialized`. Removed the Event `Initialize` that wasn't used by the system anymore.
We had to use the `contracts-upgradeable` version of the Initializeable due to the conflict of Address.sol

**OGO-11** - Shadowing of state variables

Removed as recommended removing mappings that aren't used on token implementation. Modified `_name` to `__name` and `_symbol` to  `__symbol` to not match inherited contract.

**OGO-12** - Lack of parameter validation at createBatchSeries

Limit amount of series migrated to 255 in a single batch transaction. 
Additional verification was added  to prevent wrong timestamps at the migration process. Take a look at `3-migrate-series.js:63`.
As the migration will only be used by the OtoCo team, only for migrate entities that are already deployed previously and  using the current jurisdiction rules. We will not have any concern related to the names since they already correspond with the rules used on current contracts. Also, the volume of entities migrated at once could reach 255, so we thought it could be prohibitive to use this kind of name validation at smart-contract level. Is the responsibility of the OtoCo team at the migration phase to arrange companies correctly and check possible wrong names.

**OGO-13** - Jurisdiction number causes high gas usage
To prevent rewriting values that will add 0 amount to it, we added a condition inside the loop checking if the `seriesPerJurisdictionTemp[i]` is bigger than `0` and skip the update in the affirmative case. 
We added an alert at the documentation of the function to alert not to try to migrate in case more than 500 jurisdictions exist. And recommend upgrading the function in those cases. 
We couldn't remove any Jurisdiction cause entities are linked to them. To remove jurisdictions we would be required to close all entities related to it.
We also couldn't add any constraints to jurisdictions during migration cause series will be migrated in the order of creation, so, it couldn't be prevented for one series to use a jurisdiction 1 and other uses 500 for example.
Anyway, currently OtoCo has only 3 Jurisdictions and 530 series at the moment, it's difficult to conceive a future where it supports more than 400 jurisdictions, but who knows. We also don't have plans to migrate any more series that we currently have on the system. So any other change on the function to reduce the high gas spending when a higher amount of jurisdictions would cause an increase in gas spending for the current low amount of jurisdiction and higher amount of series.

**OGO-14** - Inconsistent Documentation

Resolved according to recommendations.

**OGO-15** - Lack of mapping length validations in function createBatchSeries

Resolved according to recommendations.
