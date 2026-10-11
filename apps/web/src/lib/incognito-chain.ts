
import {
  Contract,
  JsonRpcProvider,
  keccak256,
  solidityPacked,
  type BrowserProvider,
} from "ethers";

import {
  Group,
  Identity,
  generateProof,
} from "@semaphore-protocol/core";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_INCOGNITO_ADDRESS;

const INCOGNITO_ABI = [
  "function semaphore() view returns (address)",
  "function groupId() view returns (uint256)",
  "function topicActive(uint256) view returns (bool)",
  "function topicScope(uint256) view returns (uint256)",
  "function submitReport(uint256,uint256,uint256,uint256,uint256,uint256[8])",
];

const SEMAPHORE_ABI = [
  "function getMerkleTreeRoot(uint256) view returns (uint256)",
  "event MemberAdded(uint256 indexed groupId,uint256 index,uint256 identityCommitment,uint256 merkleTreeRoot)",
  "event MemberRemoved(uint256 indexed groupId,uint256 index,uint256 identityCommitment,uint256 merkleTreeRoot)",
];

type MembershipEvent = {
  blockNumber: number;
  index: number;
  transactionIndex: number;
  args: {
    groupId: bigint;
    index: bigint;
    identityCommitment: bigint;
    merkleTreeRoot: bigint;
  };
  fragment: {
    name: string;
  };
};

function requireBlockchainConfig() {
  if (!RPC_URL || !CONTRACT_ADDRESS) {
    throw new Error(
      "Blockchain configuration is missing. Check NEXT_PUBLIC_RPC_URL and NEXT_PUBLIC_INCOGNITO_ADDRESS."
    );
  }

  return {
    rpcUrl: RPC_URL,
    contractAddress: CONTRACT_ADDRESS,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown blockchain error occurred.";
}

export function createProvider(): JsonRpcProvider {
  const { rpcUrl } = requireBlockchainConfig();

  return new JsonRpcProvider(rpcUrl);
}

export function createIdentity(): InstanceType<typeof Identity> {
  return new Identity();
}

export async function getMembershipGroup() {
  const { contractAddress } = requireBlockchainConfig();
  const provider = createProvider();

  const incognito = new Contract(
    contractAddress,
    INCOGNITO_ABI,
    provider
  );

  const semaphoreAddress: string =
    await incognito.semaphore();

  const groupId: bigint = await incognito.groupId();

  const semaphore = new Contract(
    semaphoreAddress,
    SEMAPHORE_ABI,
    provider
  );

  const [added, removed] = await Promise.all([
    semaphore.queryFilter(
      semaphore.filters.MemberAdded(groupId),
      0,
      "latest"
    ),
    semaphore.queryFilter(
      semaphore.filters.MemberRemoved(groupId),
      0,
      "latest"
    ),
  ]);

  const decodedEvents: MembershipEvent[] = [
    ...added,
    ...removed,
  ].map((event) => {
    if (
      !("args" in event) ||
      !("fragment" in event)
    ) {
      throw new Error(
        "Could not decode a Semaphore membership event. Check the contract ABI."
      );
    }

    const candidate =
      event as unknown as MembershipEvent;

    const commitment =
      candidate.args?.identityCommitment;

    const eventName = candidate.fragment?.name;

    if (
      typeof commitment !== "bigint" ||
      !["MemberAdded", "MemberRemoved"].includes(
        eventName
      )
    ) {
      throw new Error(
        "Invalid Semaphore membership event. Verify the deployed contract ABI."
      );
    }

    return candidate;
  });

  decodedEvents.sort(
    (a, b) =>
      a.blockNumber - b.blockNumber ||
      a.transactionIndex - b.transactionIndex ||
      a.index - b.index
  );

  const activeCommitments = new Set<string>();

  for (const event of decodedEvents) {
    const commitment =
      event.args.identityCommitment.toString();

    if (event.fragment.name === "MemberAdded") {
      activeCommitments.add(commitment);
    } else {
      activeCommitments.delete(commitment);
    }
  }

  const commitments = Array.from(
    activeCommitments,
    (value) => BigInt(value)
  );

  const group = new Group(commitments);

  const chainRoot = BigInt(
    await semaphore.getMerkleTreeRoot(groupId)
  );

  if (group.root !== chainRoot) {
    throw new Error(
      "The reconstructed membership group does not match the on-chain Merkle root. Verify membership events and the Semaphore tree configuration."
    );
  }

  return {
    provider,
    incognito,
    group,
    groupId,
  };
}

export async function createReportCommitment(
  encryptedPayload: string
): Promise<bigint> {
  if (
    typeof encryptedPayload !== "string" ||
    encryptedPayload.trim().length === 0
  ) {
    throw new Error(
      "Cannot create a commitment for an empty encrypted payload."
    );
  }

  return BigInt(
    keccak256(
      solidityPacked(
        ["string"],
        [encryptedPayload]
      )
    )
  );
}

export async function generateReportProof(
  identity: InstanceType<typeof Identity>,
  reportCommitment: bigint,
  topicId: bigint
) {
  if (reportCommitment <= BigInt(0)) {
    throw new Error(
      "The report commitment must be greater than zero."
    );
  }

  if (topicId <= BigInt(0)) {
    throw new Error(
      "The reporting topic ID must be greater than zero."
    );
  }

  const { incognito, group } =
    await getMembershipGroup();

  const memberIndex = group.indexOf(
    identity.commitment
  );

  if (memberIndex === -1) {
    throw new Error(
      "This identity is not enrolled in the current Semaphore membership group. Import the original enrolled identity."
    );
  }

  const isActive: boolean =
    await incognito.topicActive(topicId);

  if (!isActive) {
    throw new Error(
      `Reporting topic ${topicId.toString()} is inactive.`
    );
  }

  const scope: bigint =
    await incognito.topicScope(topicId);

  // A single-member Merkle tree can have depth 0.
  // Use at least depth 1 for proof generation.
  const proofDepth = Math.max(group.depth, 1);

  const proof = await generateProof(
    identity,
    group,
    reportCommitment,
    scope,
    proofDepth
  );

  return {
    proof,
    scope,
  };
}

export async function submitAnonymousReport(
  walletProvider: BrowserProvider,
  identity: InstanceType<typeof Identity>,
  encryptedPayload: string,
  topicId: bigint
) {
  const { contractAddress } =
    requireBlockchainConfig();

  const commitment =
    await createReportCommitment(encryptedPayload);

  const { proof } = await generateReportProof(
    identity,
    commitment,
    topicId
  );

  const signer = await walletProvider.getSigner();

  // Ensure MetaMask and the configured RPC refer to
  // the same blockchain.
  const [walletNetwork, rpcNetwork] =
    await Promise.all([
      walletProvider.getNetwork(),
      createProvider().getNetwork(),
    ]);

  if (walletNetwork.chainId !== rpcNetwork.chainId) {
    throw new Error(
      `Wrong wallet network. MetaMask is connected to chain ${walletNetwork.chainId.toString()}, but the configured RPC uses chain ${rpcNetwork.chainId.toString()}.`
    );
  }

  const contract = new Contract(
    contractAddress,
    INCOGNITO_ABI,
    signer
  );

  const reportArguments = [
    topicId,
    commitment,
    proof.merkleTreeDepth,
    BigInt(proof.merkleTreeRoot),
    BigInt(proof.nullifier),
    proof.points,
  ] as const;

  const submitReport =
    contract.getFunction("submitReport");

  // Estimate gas before opening the MetaMask
  // confirmation window. This can expose contract
  // reverts before the user signs the transaction.
  try {
    await submitReport.estimateGas(
      ...reportArguments
    );
  } catch (error: unknown) {
    throw new Error(
      `Blockchain preflight failed. The report was not submitted. ${getErrorMessage(error)}`
    );
  }

  // Request the actual transaction only after
  // proof generation and gas estimation succeed.
  const transaction = await submitReport(
    ...reportArguments
  );

  const receipt = await transaction.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error(
      "The blockchain transaction was not confirmed successfully."
    );
  }

  return {
    transactionHash: transaction.hash,
    reportCommitment: commitment.toString(),
  };
}

