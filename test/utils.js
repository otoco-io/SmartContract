const { Artifacts } = require("hardhat/internal/artifacts");
const { ethers } = require("hardhat");

async function getExternalArtifact(contract) {
  const artifactsPath = "./artifacts-external";
  const artifacts = new Artifacts(artifactsPath);
  return artifacts.readArtifact(contract);
}

async function getAmountToPay(
  jurisdiction,
  master,
  gasPrice,
  gasLimit,
  priceFeed,
) {
  const Factory = await ethers.getContractFactory([
    "JurisdictionUnincorporatedV2",
    "JurisdictionDelawareV2",
    "JurisdictionWyomingV2",
  ][jurisdiction]);
  const EthDividend =
    ethers.BigNumber.from(
      ethers.utils.parseUnits('1', 18))
      .mul(ethers.utils.parseUnits('1', 9))
      .div(10);
  const jurisdictionContract =
    await Factory.attach(await master.jurisdictionAddress(jurisdiction));
  const baseFee = await master.callStatic.baseFee();
  const { answer } = await priceFeed.callStatic.latestRoundData();
  const amountToPayForSpinUp = EthDividend.div(answer)
    .mul(await jurisdictionContract.callStatic.getJurisdictionDeployPrice())
    .add(baseFee.mul(gasLimit));
  return [
    amountToPayForSpinUp,
    ethers.BigNumber.from(gasPrice),
    ethers.BigNumber.from(gasLimit),
    baseFee,
  ];
}

exports.getExternalArtifact = getExternalArtifact;
exports.getAmountToPay = getAmountToPay;