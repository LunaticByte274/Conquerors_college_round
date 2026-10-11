
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title Incognito
/// @notice Topic-scoped anonymous reporting using Semaphore V4.
contract Incognito {
    ISemaphore public immutable semaphore;
    uint256 public immutable groupId;
    address public owner;

    mapping(uint256 => bool) public topicActive;

    error NotOwner();
    error InvalidTopic();
    error InvalidScope();
    error InvalidMessage();
    error ZeroCommitment();

    event TopicStatusChanged(uint256 indexed topicId, bool active);
    event MemberEnrolled(uint256 indexed identityCommitment);
    event MemberRevoked(uint256 indexed identityCommitment);
    event ReportSubmitted(
        uint256 indexed topicId,
        uint256 indexed reportCommitment,
        uint256 nullifier
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address semaphoreAddress) {
        semaphore = ISemaphore(semaphoreAddress);
        owner = msg.sender;

        // The Incognito contract becomes the Semaphore group administrator.
        groupId = semaphore.createGroup();
    }

    /// @notice Activate or deactivate a reporting topic.
    function setTopicActive(
        uint256 topicId,
        bool active
    ) external onlyOwner {
        topicActive[topicId] = active;
        emit TopicStatusChanged(topicId, active);
    }

    /// @notice Enroll an approved participant's Semaphore identity commitment.
    /// Only the administrator can enroll members.
    function enrollMember(
        uint256 identityCommitment
    ) external onlyOwner {
        if (identityCommitment == 0) revert ZeroCommitment();

        semaphore.addMember(groupId, identityCommitment);
        emit MemberEnrolled(identityCommitment);
    }

    /// @notice Revoke membership using the Merkle proof required by Semaphore.
    function revokeMember(
        uint256 identityCommitment,
        uint256[] calldata merkleProofSiblings
    ) external onlyOwner {
        semaphore.removeMember(
            groupId,
            identityCommitment,
            merkleProofSiblings
        );

        emit MemberRevoked(identityCommitment);
    }

    /// @notice Deterministic scope: a proof must be bound to this topic
    /// and this deployed Incognito contract.
    function topicScope(
        uint256 topicId
    ) public view returns (uint256) {
        return uint256(
            keccak256(abi.encodePacked(address(this), topicId))
        ) >> 8;
    }

    /// @notice Submit a report commitment with a valid anonymous membership proof.
    /// The report body must be stored separately, encrypted off-chain.
    function submitReport(
        uint256 topicId,
        uint256 reportCommitment,
        uint256 merkleTreeDepth,
        uint256 merkleTreeRoot,
        uint256 nullifier,
        uint256[8] calldata points
    ) external {
        if (!topicActive[topicId]) revert InvalidTopic();
        if (reportCommitment == 0) revert ZeroCommitment();

        uint256 expectedScope = topicScope(topicId);

        ISemaphore.SemaphoreProof memory proof = ISemaphore.SemaphoreProof({
            merkleTreeDepth: merkleTreeDepth,
            merkleTreeRoot: merkleTreeRoot,
            nullifier: nullifier,
            message: reportCommitment,
            scope: expectedScope,
            points: points
        });

        // Semaphore checks membership, proof validity, and nullifier reuse.
        // The public transaction sender is NOT used as the reporter identity.
        semaphore.validateProof(groupId, proof);

        emit ReportSubmitted(topicId, reportCommitment, nullifier);
    }
}
