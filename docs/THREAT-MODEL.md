# Incognito — Threat Model

## Assets
- Reporter identity and identity secret
- Membership credentials
- Anonymous reports
- Topic-scoped nullifiers
- Moderation and revocation controls

## Adversaries
- Outsiders without valid membership
- Members attempting duplicate submissions
- Malicious or abusive reporters
- Unauthorised administrators
- Administrators attempting identity correlation
- Parties attempting metadata-based correlation

## Security goals
- Prove eligible membership without revealing identity
- Reject forged proofs and duplicate submissions
- Prevent cross-topic identity correlation
- Keep report content off the public blockchain
- Minimise metadata collection and identity leakage

## Limitations to evaluate
- Timing and network metadata
- Identifying report content
- Membership issuer and moderator collusion
- Credential revocation semantics
- Relayer trust and availability
