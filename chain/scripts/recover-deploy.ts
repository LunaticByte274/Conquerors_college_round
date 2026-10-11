import { ethers, run } from "hardhat";

async function main() {
  const verifierAddress = "0x382d2DbFC9A0A65695F7823922C82Ac1636fD0a8";

  const verifierCode = await ethers.provider.getCode(verifierAddress);
  if (verifierCode === "0x") {
    throw new Error("Verifier bytecode missing; refusing to continue");
  }

  console.log("Reusing verifier:", verifierAddress);

  const { semaphore, poseidonAddress } = await run("deploy:semaphore", {
    semaphoreVerifier: verifierAddress,
    logs: true
  });

  await semaphore.waitForDeployment();
  const semaphoreAddress = await semaphore.getAddress();

  console.log("Semaphore confirmed:", semaphoreAddress);
  console.log("Poseidon library:", poseidonAddress);

  const semaphoreCode = await ethers.provider.getCode(semaphoreAddress);
  if (semaphoreCode === "0x") {
    throw new Error("Semaphore deployment has no bytecode; refusing Incognito deployment");
  }

  const IncognitoFactory = await ethers.getContractFactory("Incognito");
  const incognito = await IncognitoFactory.deploy(semaphoreAddress);
  await incognito.waitForDeployment();

  console.log("Incognito contract deployed to:", await incognito.getAddress());
  console.log("Semaphore address:", semaphoreAddress);
  console.log("Verifier address:", verifierAddress);
}

main().catch((error) => {
  console.error("Recovery deployment failed:", error.shortMessage || error.message);
  process.exitCode = 1;
});
