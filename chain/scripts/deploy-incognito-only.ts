import { ethers } from "hardhat";

async function main() {
  const semaphoreAddress = "0xDa134C03F51eA74752BFCa098a363429Bfcda3D1";

  const code = await ethers.provider.getCode(semaphoreAddress);
  console.log("Semaphore bytecode exists:", code !== "0x");

  if (code === "0x") {
    throw new Error("No contract bytecode at the Semaphore address");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());
  console.log(
    "Balance (ETH):",
    ethers.formatEther(await ethers.provider.getBalance(await deployer.getAddress()))
  );

  const Factory = await ethers.getContractFactory("Incognito");
  const deployment = await Factory.getDeployTransaction(semaphoreAddress);
  const estimate = await ethers.provider.estimateGas({
    ...deployment,
    from: await deployer.getAddress(),
  });

  console.log("Estimated deployment gas:", estimate.toString());

  const contract = await Factory.deploy(semaphoreAddress);
  await contract.waitForDeployment();
  console.log("Incognito deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error("Deployment test failed:", error.shortMessage || error.message);
  process.exitCode = 1;
});
