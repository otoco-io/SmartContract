# OtoCo Smart Contracts V2 - Internal Audit 

## Table of Contents
+ **[Overview](#overview)**<br>
+ **[Audit Methodoly](#audit-methodoly)**<br>
+ **[Findings](#findings)**<br>
+ **[Risk Categorization Legend](#risk-categorization-legend)**<br>
+ **[Issues Description](#issues-description)**<br> 

## Overview
This document represents the internal security assesment of the [OtoCo smart contracts](https://github.com/otoco-io/SmartContract), conducted within the timeframe of a week, from 14/01/2023 to 21/01/2023. The purpose of this audit is to report on the penetration test findings, obtained through the usage of both manual inspection and via automated analysis ([Slither][1]), excluding issues related to optimizational aspects (*i.e.*, gas savings, minor code quality issues).

---
<br>

## Audit Methodoly
The audit methodology applied consists in the recursive intercalation of the following steps until mitigation of all identified vulnerabilites: 
1. Conjunt effort between the developer and auditor in order to identify possible threat vectors, or filter out false suspections; 
2. Selective static analysis with specific detectors ran on source code either to corroborate or disregard such raised suspections;
3. Elaborate threat model to attack the contract in attempt of exploiting the vulnerability;
4. Developer proposes a fix for the vulnerability and auditor remodels attack vector.

```
              ┌───────────────────┐
┌─────────────┤ Audit Methodology ├─────────────┐
│             └───────────────────┘             │
│                                               │
│                   ┌───────┐                   │
│                   │       │                   │
│  ┌────────────────┤   1   │                   │
│  │                │       │                   │
│  │                └───┬───┘                   │
│  │                    │                       │
│  │                    ▼                       │
│  │       ┌──────────────────────────┐         │
│  │       │ Suspected Threat Vectors │         │
│  │       └────────────┬─────────────┘         │
│  │                    │                       │
│  │                    ▼                       │
│  │                ┌───────┐                   │
│  │                │       │                   │
│  │                │   2   │                   │
│  │                │       │                   │
│  │        ✗       └───┬───┘       ✔          │
│  │  ┌───────────┐     │     ┌───────────┐     │
│  └──┤ Discarded │◄────┴────►│ Confirmed ├──┐  │
│  ▲  └───────────┘           └───────────┘  │  │
│  │                ┌───────┐                │  │
│  │                │       │                │  │
│  │                │   3   │◄───────────────┘  │
│  │                │       │                   │
│  │        ✗       └───┬───┘       ✔          │
│  │    ┌────────┐      │      ┌─────────┐      │
│  └────┤ Failed │◄─────┴─────►│ Success ├───┐  │
│       └────────┘             └─────────┘   │  │
│                   ┌───────┐                │  │
│                   │       │                │  │
│  ┌────────────────┤   4   │◄───────────────┘  │
│  │                │       │                   │
│  │                └───────┘                   │
│  │                                            │
│  │         ┌───────────────────────────────┐  │
│  └────────►│ All Vulnerabilities Mitigated │  │
│            └───────────────────────────────┘  │
│                                               │
│                                               │
└───────────────────────────────────────────────┘
```

---
<br>

## Findings
Two vulnerabilites had been confirmed by the auditing process, one of moderate and the other of critical severity. Once reported, both were quickly fixed by the developer.

### Steps of the proccess
Two suspected possible threat vectors, that restricted the scope of the audit, were presented by the developer and further elaborated by the auditor. The former regards issues with incorrect storage migration in upgradeable contracts — which, despite being confirmed by static analysis, were discarded as false positives —; the latter concerns about reentrancy vulnerability — which not only was confirmed but also revealed another attack susceptibility that allows unintended free NFT mints (bypassing the protocol's fee whilst creating a new Series instance). 

---
<br>

## Risk Categorization Legend

| Risk Level    | Nature & Measures                                                                                                                                                                                          |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| <span style="color:red;">Critical</span>      | Severe vulnerability that enables the contract <br>to be broken; as in fund draining or permanent <br>contract freezing. Requires immediate action.                                                        |
| <span style="color:yellow;">Moderate</span>  | Bearable vulnerability that may lead to unintended <br>contract's behavior or introduce unforeseen <br>future vulnerable breaches. Should be fixed <br>as soon as possible.                                    |
| <span style="color:blue;">Optimization</span> | Issues non related to exploitable code; <br>associated with untrusted by community <br>practices, bad architecture or inadvisable <br>for business choices. Advisable to be <br>reimplemented if possible. |

---
<br>

## Issues Description

### Reentrancy in `createEntityWithInitializer`

- **Risk**: <span style="color:yellow;">Moderate</span> 
- **File**: OtoCoMasterV2.sol

In attempt to ease plugin extendability, the function `createEntityWithInitializer` allows a user to arbitrarily set the destination address as much as the calldata sent in the external call made to an initializer address, as intended by the developer. Nonetheless, this mechanism enables a malicious actor to encode a malicious payload in the calldata such as the sighash of an external function that reenters the contract; thus, breaking the intended behaviour designed for the protocol and augmenting the damage caused by attack vectors such as the [free mint in `createSeries`](#free-mint-in-createseries).

```ts
    function createEntityWithInitializer(
        uint16 jurisdiction,
        address[] calldata plugins,
        bytes[] calldata pluginsData,
        uint256 value,
        string calldata name
    )
        public
        payable
        enoughAmountUSD(
            IOtoCoJurisdiction(jurisdictionAddress[jurisdiction])
                .getJurisdictionDeployPrice()
        )
    {
        address controller = msg.sender;
        if (msg.value < value)
            revert InsufficientValue({available: msg.value, required: value});
        (bool success, bytes memory initializerBytes) = plugins[0].call{
            value: value
        }(pluginsData[0]);
// {...}
```

### Free mint in `createSeries`

- **Risk**: <span style="color:red;">Critical</span> 
- **File**: OtoCoMasterV2.sol

The payable function `createSeries` enables an user to mint an NFT as the expected behavior for the creation of a new Series, charging an fee for such service as intended by the developer. When this method gets called via the function `createEntityWithInitializer`, the `msg.value` can be sent back to the caller through the external call made to the initializer's destination address.
```ts
// {...}
        if (msg.value < value)
            revert InsufficientValue({available: msg.value, required: value});
        (bool success, bytes memory initializerBytes) = plugins[0].call{
            value: value
        }(pluginsData[0]);

        if (!success) revert InitializerError();
        assembly {
            controller := mload(add(initializerBytes, 32))
        }
        uint256 current = seriesCount;
        createSeries(jurisdiction, controller, name);
        for (uint8 i = 1; i < plugins.length; i++) {
            IOtoCoPlugin(plugins[i]).addPlugin(current, pluginsData[i]);
        }
    }
```

Even though the balance sent to OtoCoMasterV2 has already been withdrawn, `msg.value` is kept the same throughout the whole call context. Since `createSeries` only checks for the `msg.value` in it's control flow through the `enoughAmountUSD` modidifier, protocol's fee can then be bypassed when `_mint` transfers a new Series to the controller address.
```ts
	modifier enoughAmountUSD(uint256 usdPrice) {
			(, int256 quote, , , ) = priceFeed.latestRoundData();
			if (msg.value < (priceFeedEth / uint256(quote)) * usdPrice)
					revert InsufficientValue({
							available: msg.value,
							required: usdPrice * uint256(quote)
					});
			_;
	}

    function createSeries(
        uint16 jurisdiction,
        address controller,
        string memory name
    )
        public
        payable
        enoughAmountUSD(
            IOtoCoJurisdiction(jurisdictionAddress[jurisdiction])
                .getJurisdictionDeployPrice()
        )
    {
	// {...}
        _mint(controller, current);
    }
``` 

### Threat Model used to attack the contract
The threat model used to successfully exploit the contract combines the previous vulnerabilities ([reentrancy in `createEntityWithInitializer`](#reentrancy-in-createentitywithinitializer) and [free mint in `createSeries`](#free-mint-in-createseries)) to mint a free Series per each reentrant call.

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                                Attacker              │
│                                 ┌────┐               │
│                                 │┼┼┼┼│               │
│                                 │┼┼┼┼│               │
│                                 └────┘               │
│                                                      │
│                                   │                  │
│                                   │                  │
│                                   │                  │
│                                   │                  │
│     Attack                        │  OtoCoMasterV2   │
│    Contract                       │     Contract     │
│  ┌──────────┐        balance      ▼  ┌───────────┐   │
│  │┼┼┼┼┼┼┼┼┼┼│         transfer       │┼┼┼┼┼┼┼┼┼┼┼│   │
│  │┼┼┼┼┼┼┼┼┼┼│ * ◄──────────────── ** │┼┼┼┼┼┼┼┼┼┼┼│   │
│  │┼┼┼┼┼┼┼┼┼┼│                      ▲ │┼┼┼┼┼┼┼┼┼┼┼│   │
│  │┼┼┼┼┼┼┼┼┼┼│ │                    │ │┼┼┼┼┼┼┼┼┼┼┼│   │
│  │┼┼┼┼┼┼┼┼┼┼│ └────────────────────┘ │┼┼┼┼┼┼┼┼┼┼┼│   │
│  │┼┼┼┼┼┼┼┼┼┼│     reentrancy call    │┼┼┼┼┼┼┼┼┼┼┼│   │
│  └──────────┘                        │┼┼┼┼┼┼┼┼┼┼┼│   │
│                                      └───────────┘   │
│                                                ***   │
│                                                      │
│                                                  │   │
│                                            free  │   │
│                                             Mint │   │
│                                                  │   │
│                                                  ▼   │
│                                                      │
│                       Legend:                        │
│       ┌───────────────────────────────────┐          │
│       │*   = callback()                   │          │
│       │**  = createEntityWithInitializer()│          │
│       │*** = createSeries()               │          │
│       └───────────────────────────────────┘          │
│                                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

An EOA Attacker could use a contract with a callback function to inject external logic in its calldata to reenter the OtoCoMasterV2 contract, within the same context of execution of `createEntityWithInitializer`, in order to mint any desired number of free Series.
```ts
    function callback() external payable {
      if (c > l) { return; } else { c++;
        ( bool success, bytes memory data ) 
              = t.call{value: m}(p);
		// {...}
			}
		}
```

### Mitigation measures taken to fix the vulnerabilities
The developer implemented modifications to `createEntityWithInitializer`, in `OtoCoMasterV2.sol`, that render the previously confirmed vulnerabilities infeasible.

```ts
		
    function createEntityWithInitializer(
        uint16 jurisdiction,
        address[] calldata plugins,
        bytes[] calldata pluginsData,
        uint256 value,
        string calldata name
    ) public payable {
        uint256 valueRequired = gasleft() *
            baseFee +
            priceConverter(
                IOtoCoJurisdiction(jurisdictionAddress[jurisdiction])
                    .getJurisdictionDeployPrice()
            ) +
            value;
        if (msg.value < valueRequired)
            revert InsufficientValue({
                available: msg.value,
                required: valueRequired
            });
		// {...}
		}
```

The new version of the function renders the attack ineffective by basing control flow on the variable `valueRequired`, calculated by multiplying remaining gas by the state variable `baseFee` and adding it to the sum of the user-provided parameter `value` and the minimum deploy price. Thus, acting as both a reentrancy lock and assurance of service fee charge; due to the fact that the `msg.value` is required to be greater than `valueRequired`.

---
<br>


[1]: https://github.com/crytic/slither