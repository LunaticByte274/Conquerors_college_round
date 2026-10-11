import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();
  const balance = await ethers.provider.getBalance(address);

  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Deployer:", address);
  console.log("Balance (ETH):", ethers.formatEther(balance));

  if (network.chainId !== 11155111n) {
    throw new Error("Wrong network. Expected Sepolia.");
  }

  if (balance === 0n) {
    throw new Error("Deployer has no Sepolia ETH.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
