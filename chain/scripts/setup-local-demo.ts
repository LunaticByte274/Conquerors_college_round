
import { Identity } from "@semaphore-protocol/core";
import { ethers } from "hardhat";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const backupPath = path.resolve(
    "../apps/web/private/member-identity.backup"
  );

  const exported = (await readFile(backupPath, "utf8")).trim();
  const identityBytes = Buffer.from(exported, "base64");

  if (!exported || identityBytes.length === 0) {
    throw new Error("Identity backup is empty or invalid.");
  }

  const identity = new Identity(new Uint8Array(identityBytes));

  const expectedCommitment =
    "7818985346677532339848002664042104268490127851703022271340616338897340146927";

  if (identity.commitment.toString() !== expectedCommitment) {
    throw new Error(
      "Identity commitment mismatch. Stopped without enrolling."
    );
  }

  const contractAddress = process.env.INCOGNITO_ADDRESS;
  if (!contractAddress) {
    throw new Error("INCOGNITO_ADDRESS is not set.");
  }

  const [owner] = await ethers.getSigners();
  const incognito = await ethers.getContractAt(
    "Incognito",
    contractAddress,
    owner
  );

  const actualOwner = await incognito.owner();
  if (actualOwner.toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error("Connected account does not own this contract.");
  }

  const configuredSemaphore = await incognito.semaphore();
  console.log("Incognito contract:", await incognito.getAddress());
  console.log("Using configured Semaphore:", configuredSemaphore);

  for (const topicId of [1n, 2n, 3n]) {
    if (!(await incognito.topicActive(topicId))) {
      const tx = await incognito.setTopicActive(topicId, true);
      await tx.wait();
      console.log(`Activated topic ${topicId}`);
    } else {
      console.log(`Topic ${topicId} is already active`);
    }
  }

  const existingEvents = await incognito.queryFilter(
    incognito.filters.MemberEnrolled(identity.commitment)
  );

  if (existingEvents.length === 0) {
    const tx = await incognito.enrollMember(identity.commitment);
    await tx.wait();
    console.log("Saved identity enrolled successfully.");
  } else {
    console.log("Saved identity is already enrolled.");
  }

  console.log("Setup complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

