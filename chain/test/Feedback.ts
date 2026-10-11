
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Group, Identity, generateProof } from "@semaphore-protocol/core";
import { expect } from "chai";
import {
    encodeBytes32String,
    solidityPackedKeccak256
} from "ethers";
import { ethers, run } from "hardhat";
import { Incognito, ISemaphore } from "../typechain-types";

describe("Incognito", () => {
    async function deployFixture() {
        const [owner, outsider] = await ethers.getSigners();

        const { semaphore } = await run("deploy:semaphore", {
            logs: false
        });

        const semaphoreContract: ISemaphore = semaphore;

        const incognito: Incognito = await run("deploy", {
            logs: false,
            semaphore: await semaphoreContract.getAddress()
        });

        return { owner, outsider, semaphoreContract, incognito };
    }

    async function setupMembers(incognito: Incognito) {
        const identities = [new Identity(), new Identity()];
        const group = new Group();

        for (const identity of identities) {
            await incognito.enrollMember(identity.commitment);
            group.addMember(identity.commitment);
        }

        return { identities, group };
    }

    async function getScope(incognito: Incognito, topicId: bigint) {
        const address = await incognito.getAddress();
        const packedHash = solidityPackedKeccak256(
            ["address", "uint256"],
            [address, topicId]
        );

        return BigInt(packedHash) >> 8n;
    }

    async function makeProof(
        incognito: Incognito,
        identity: InstanceType<typeof Identity>,
        group: Group,
        topicId: bigint,
        message: bigint
    ) {
        const scope = await getScope(incognito, topicId);
        return generateProof(identity, group, message, scope);
    }

    it("allows only the owner to enroll members", async () => {
        const { outsider, incognito } = await loadFixture(deployFixture);
        const identity = new Identity();

        await expect(
            incognito.connect(outsider).enrollMember(identity.commitment)
        ).to.be.revertedWithCustomError(incognito, "NotOwner");

        await expect(
            incognito.enrollMember(identity.commitment)
        ).not.to.be.reverted;
    });

    it("rejects reports for inactive topics", async () => {
        const { incognito } = await loadFixture(deployFixture);
        const { identities, group } = await setupMembers(incognito);

        const topicId = 1n;
        const commitment = BigInt(encodeBytes32String("report-A"));
        const proof = await makeProof(
            incognito, identities[0], group, topicId, commitment
        );

        await expect(
            incognito.submitReport(
                topicId,
                commitment,
                proof.merkleTreeDepth,
                proof.merkleTreeRoot,
                proof.nullifier,
                proof.points
            )
        ).to.be.revertedWithCustomError(incognito, "InvalidTopic");
    });

    it("accepts a valid anonymous report for an active topic", async () => {
        const { incognito } = await loadFixture(deployFixture);
        const { identities, group } = await setupMembers(incognito);

        const topicId = 1n;
        const commitment = BigInt(encodeBytes32String("report-A"));

        await incognito.setTopicActive(topicId, true);

        const proof = await makeProof(
            incognito, identities[0], group, topicId, commitment
        );

        await expect(
            incognito.submitReport(
                topicId,
                commitment,
                proof.merkleTreeDepth,
                proof.merkleTreeRoot,
                proof.nullifier,
                proof.points
            )
        )
            .to.emit(incognito, "ReportSubmitted")
            .withArgs(topicId, commitment, proof.nullifier);
    });

    it("rejects a second submission by the same identity in the same topic", async () => {
        const { semaphoreContract, incognito } =
            await loadFixture(deployFixture);

        const { identities, group } = await setupMembers(incognito);
        const topicId = 1n;

        await incognito.setTopicActive(topicId, true);

        const commitment = BigInt(encodeBytes32String("report-A"));
        const proof = await makeProof(
            incognito, identities[0], group, topicId, commitment
        );

        const args = [
            topicId,
            commitment,
            proof.merkleTreeDepth,
            proof.merkleTreeRoot,
            proof.nullifier,
            proof.points
        ] as const;

        await incognito.submitReport(...args);

        await expect(
            incognito.submitReport(...args)
        ).to.be.revertedWithCustomError(
            semaphoreContract,
            "Semaphore__YouAreUsingTheSameNullifierTwice"
        );
    });

    it("allows the same identity to submit in two different topics", async () => {
        const { incognito } = await loadFixture(deployFixture);
        const { identities, group } = await setupMembers(incognito);

        const topicA = 1n;
        const topicB = 2n;
        const commitmentA = BigInt(encodeBytes32String("report-A"));
        const commitmentB = BigInt(encodeBytes32String("report-B"));

        await incognito.setTopicActive(topicA, true);
        await incognito.setTopicActive(topicB, true);

        const proofA = await makeProof(
            incognito, identities[0], group, topicA, commitmentA
        );
        const proofB = await makeProof(
            incognito, identities[0], group, topicB, commitmentB
        );

        expect(proofA.nullifier).not.to.equal(proofB.nullifier);

        await incognito.submitReport(
            topicA, commitmentA,
            proofA.merkleTreeDepth, proofA.merkleTreeRoot,
            proofA.nullifier, proofA.points
        );

        await expect(
            incognito.submitReport(
                topicB, commitmentB,
                proofB.merkleTreeDepth, proofB.merkleTreeRoot,
                proofB.nullifier, proofB.points
            )
        ).to.emit(incognito, "ReportSubmitted");
    });
});
