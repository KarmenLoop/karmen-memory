# Security reporting

Do not post credentials, private memories, personal database exports, or a working exploit in a public issue.

Use GitHub's **Report a vulnerability** option in the Security tab when available. Otherwise, contact `info@karmenloop.com` with a minimal description and ask for a private reporting route before sending sensitive material.

Include the affected commit or version, expected boundary, observed behavior, and a reproduction using synthetic data. Do not send a real memory library.

## Current scope

This release is a browser prototype. It uses localStorage, has no authentication service, and does not implement encrypted storage or LAN synchronization. Its fixed demo pairing code is not a production security mechanism. Use it locally with synthetic data.

Future adapters must verify identities, project scope, revocation, and actual tool permissions. Reading a remembered fact must not transfer approval to execute an action on another device.

Security fixes target the current published version. Response times depend on maintainer availability; no security SLA is offered.
