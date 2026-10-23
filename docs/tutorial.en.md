# KARMEN Memory user guide

English | [简体中文](tutorial.zh-CN.md) · [Project](../README.md)

This guide matches **v0.2.0**, the local service alpha. The interface is Chinese; the documentation is bilingual.

## Download and start

Choose the runtime ZIP for the built interface plus service source, the source ZIP for development, or a separate skill ZIP. Compare the complete local SHA-256 with the corresponding SHA256SUMS entry (`shasum -a 256 FILE` on macOS, `Get-FileHash -Algorithm SHA256 FILE` in PowerShell).

Use Node 22.16+ and npm. From the runtime directory run `npm ci` and `npm start`; open `http://127.0.0.1:4318`. Source downloads also need `npm run build` before startup. A static file server alone cannot supply the API. LAN setup needs OpenSSL supporting `req -addext`. Windows runtime has not been accepted.

## Create and retrieve a fact

Create a synthetic fact, such as “Use English commit messages,” in a project named `My Project`. Set its type, evidence, and local/shared scope. Search its title and inspect the same memory ID and revision. Edit it, reload, and inspect the previous revision. Favorite, archive, and restore it; archived facts leave retrieval while history remains.

Extraction uses explicit sentence rules, and retrieval uses multilingual lexical matching. Neither calls a model. Paste explicit requirements on Extraction, inspect candidates and their source evidence, edit conditions, then approve. A replacement archives the old fact and links its successor. Stale concurrent edits conflict rather than overwrite.

## Configure another client

Create an exact-project read-only credential under Agent access. Save its token in a private mode-0600 file, set `KARMEN_MEMORY_TOKEN_FILE`, and run `node bin/memory.mjs search "commit" --project "My Project"`. Compare the returned ID with the console. A read/write credential can submit candidates; it does not approve them. CI requires a named project and read-only access.

The [integration guide](integration.md) includes the MCP stdio template and HTTP contract. The supplied CLI is a memory client, not Koder CLI. Configure installed hosts separately. The runtime `karmen-memory` skill guides retrieval and proposals; `shared-memory-console` guides interface design. Preserve each complete folder and notices when installing.

## Pair a computer

Enable HTTPS sharing, copy the public certificate through a trusted channel, compare its fingerprint, then generate a one-use five-minute code. Run the pairing command shown in the console with `--ca FILE` on the other computer. A profile is saved privately; an existing profile is never overwritten. Only shared facts in the granted project are visible. Revocation applies on the next request. Closing sharing or clean shutdown stops the listener. The primary node must remain available; there is no offline replica.

## Backup, updates, and troubleshooting

Use JSON for additive fact transfer (2 MB/5,000-record limits) and a SQLite snapshot for full history and audit. Imports validate the entire file and skip duplicate bodies within a project. Legacy prototype records need explicit confirmation. [Getting started](getting-started.md) describes full snapshot restore, preserving the old database and WAL together before replacement.

Before updating, make a private snapshot, retain the old application, and verify the new version using an isolated data directory. Do not overwrite a live database or attempt an unsupported schema downgrade. If facts appear missing, inspect `KARMEN_MEMORY_HOME`, the project scope, and lifecycle state. If service connection fails, verify the actual process and loopback port. Expired owner sessions can reconnect from the page. If a write loses its response, inspect the activity/candidate before retrying; CLI idempotency keys permit exact replay.

Native installed hosts, two physical computers, platform installers, semantic models, independent security review, and model savings remain separate acceptance tasks. See [Validation](validation.md).

[Apache-2.0](../LICENSE) · [NOTICE](../NOTICE) · [Third-party notices](../THIRD_PARTY_NOTICES.md)
