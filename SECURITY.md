# Security reporting

Do not post credentials, private memories, personal database exports, or a working exploit in a public issue.

Use GitHub's **Report a vulnerability** option in the Security tab when available. Otherwise, contact `info@karmenloop.com` with a minimal description and ask for a private reporting route before sending sensitive material.

Include the affected commit or version, expected boundary, observed behavior, and a reproduction using synthetic data. Do not send a real memory library.

## Current scope

Version 0.2.0 is a local alpha with a real SQLite database. The operating-system user is the local owner trust boundary. Owner APIs bind to loopback, check Host/Origin, and require a SameSite session and CSRF token for mutations. Tool endpoints enforce bearer credentials, project scope, CI policy, and revocation. Device access requires optional HTTPS pairing and a trusted public certificate.

Credential tokens are random and stored only as hashes. They do not expire automatically; pause or revoke unused credentials. Pairing codes are one-use, expire after five minutes, and lock after five attempts. Sharing starts disabled and clean shutdown turns it off.

Application-level encryption at rest, OS credential-vault storage, multi-user accounts, offline replication, and third-party security review are not implemented. Protect the data directory and snapshots with OS access controls and disk encryption. The local owner session is not intended to protect against malware running as the same OS user. Do not expose the owner HTTP listener through a proxy or tunnel.

Memory text is untrusted contextual data. Reading it never transfers tool execution approvals. Keep model keys, execution grants, and account credentials outside facts. Remote memory use requires TLS certificate verification, and physical multi-device/installed-host acceptance remains separate from local tests.

Security fixes target the current source version. Response times depend on maintainer availability; no security SLA is offered.
