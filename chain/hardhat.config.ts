import "@nomicfoundation/hardhat-toolbox";
import "@semaphore-protocol/hardhat";
import { getHardhatNetworks } from "@semaphore-protocol/utils";
import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "./tasks/deploy";

const privateKey = process.env.ETHEREUM_PRIVATE_KEY?.replace(/^0x/, "");

const config: HardhatUserConfig = {
  solidity: "0.8.23",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    ...getHardhatNetworks(process.env.ETHEREUM_PRIVATE_KEY),
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      chainId: 11155111,
      accounts: privateKey ? [`0x${privateKey}`] : [],
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS === "true",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  typechain: {
    target: "ethers-v6",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
