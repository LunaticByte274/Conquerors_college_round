
"use client";

import { useCallback, useEffect, useState } from "react";
import { BrowserProvider } from "ethers";

type WalletConnectProps = {
  onConnected: (
    provider: BrowserProvider,
    address: string
  ) => void;
};

type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;

  on?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;

  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const EXPECTED_CHAIN_ID = BigInt(1337);

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 4001
  ) {
    return "Wallet connection was rejected.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Wallet connection failed. Please try again.";
}

export default function WalletConnect({
  onConnected,
}: WalletConnectProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const connectWallet = useCallback(async () => {
    setError("");

    const ethereum = window.ethereum;

    if (!ethereum) {
      setError(
        "No compatible browser wallet was detected. Install or enable MetaMask."
      );
      return;
    }

    setConnecting(true);

    try {
      const result = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (
        !Array.isArray(result) ||
        typeof result[0] !== "string" ||
        result[0].length === 0
      ) {
        throw new Error(
          "No wallet account was selected. Unlock your wallet and try again."
        );
      }

      const provider = new BrowserProvider(
        ethereum as never
      );

      const network = await provider.getNetwork();

      if (network.chainId !== EXPECTED_CHAIN_ID) {
        setAddress("");

        throw new Error(
          "Wrong network. Switch MetaMask to your local Hardhat network (chain ID 1337) and try again."
        );
      }

      const signer = await provider.getSigner();
      const connectedAddress = await signer.getAddress();

      setAddress(connectedAddress);
      onConnected(provider, connectedAddress);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  }, [onConnected]);

  useEffect(() => {
    const ethereum = window.ethereum;

    if (!ethereum?.on) {
      return;
    }

    const handleAccountsChanged = (
      accounts: unknown
    ) => {
      if (
        !Array.isArray(accounts) ||
        typeof accounts[0] !== "string"
      ) {
        setAddress("");
        setError("Wallet disconnected. Connect your wallet again.");
        return;
      }

      // The previous provider/account may no longer be
      // the account selected in the wallet.
      setAddress("");
      setError(
        "Wallet account changed. Reconnect to continue."
      );
    };

    const handleChainChanged = () => {
      setAddress("");
      setError(
        "Wallet network changed. Reconnect using Hardhat chain ID 1337."
      );
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.(
        "accountsChanged",
        handleAccountsChanged
      );

      ethereum.removeListener?.(
        "chainChanged",
        handleChainChanged
      );
    };
  }, []);

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={connectWallet}
        disabled={connecting}
        aria-busy={connecting}
        className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {connecting
          ? "Connecting..."
          : address
            ? `${address.slice(0, 6)}…${address.slice(-4)}`
            : "Connect wallet"}
      </button>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 max-w-lg break-words text-sm text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}

