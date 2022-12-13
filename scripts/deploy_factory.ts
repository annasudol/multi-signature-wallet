import { ethers } from "hardhat";

async function main() {

  const factory = await ethers.getContractFactory("MultiSigWalletFactory");
  const factory_contract = await factory.deploy();

  await factory_contract.deployed();

  console.log(`Factory contract deployed to ${factory_contract.address}`);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
