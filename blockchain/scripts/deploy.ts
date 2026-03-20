import { ethers } from "hardhat";

async function main() {
  const SitrepRegistry = await ethers.getContractFactory("SitrepRegistry");
  const registry = await SitrepRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`SitrepRegistry deployed to: ${address}`);
  console.log(`Owner: ${(await ethers.getSigners())[0].address}`);
  console.log(`\nAdd to backend .env:`);
  console.log(`BLOCKCHAIN_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
