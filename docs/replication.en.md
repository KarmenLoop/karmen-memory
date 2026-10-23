# Offline replicas and host setup — v0.3.0

[English](replication.en.md) · [中文](replication.zh-CN.md)

This release extends the existing memory service. Approved facts, immutable revisions, extraction, retrieval, CLI credentials, and the v0.2.0 database remain in place. No export/reimport is needed to upgrade. Stop the old process, privately back up the complete data directory, and start v0.3.0 with that same `KARMEN_MEMORY_HOME`.

## Install and connect a host

Download the v0.3.0 runtime from Releases. In its extracted directory run `npm ci` and `npm start` with Node 22.16+. Source archives also need `npm run build`. Keep the service running. Open the local console and create a project-scoped agent credential under Agent access. Save a private JSON profile with `url` and `token`, outside Git and with mode 0600. A remote profile may also use `ca` with its verified certificate file path.

```sh
node bin/install-host.mjs --host codex --workspace /path/to/project --profile /private/codex-memory.json
node bin/install-host.mjs --host cursor --workspace /path/to/project --profile /private/cursor-memory.json
```

Use separate credentials/profiles for each host. The installer preserves unrelated entries, validates the resulting TOML/JSON, and refuses to replace the same server name. Reload the host, trust only your own project, approve this specific MCP server, and perform a real `memory_search` call. Existing CLI and MCP contracts remain compatible: proposals still need owner review. A host requires its own sign-in/model access.

## Pair an offline replica

1. Install and run Memory on both computers with different private data directories. Each library retains its own identity.
2. Enable LAN sharing in the receiving console. Download its public certificate and compare the SHA-256 fingerprint over a trusted channel. Open the HTTPS port only to the intended LAN.
3. In the new **Offline replicas** panel, enter an exact allowed project and create a one-use replication code. It expires after ten minutes. This code is separate from the original remote-search pairing code.
4. In the other console's replica panel, enter the receiver's private IPv4 HTTPS address, verified PEM certificate, code, and local device name. Never disable certificate checks or bypass browser TLS warnings.
5. Create or approve a record marked 全设备 in the allowed project. Choose **Sync now**. The same fact ID, content, and source should appear in the receiving library, alongside its local revision history. 本机 records, pending proposals, credentials, API configuration, and execution grants do not enter the feed.

One initiating connection synchronizes in both directions. Automatic retries run while that service is running. Stop a service, edit the other library, then restart using the original directory and synchronize; the offline change should arrive. Clean shutdown keeps the original service behavior of turning its LAN listener off; after restarting a receiving store, explicitly enable LAN sharing again before peers can reconnect. Conflicting offline edits are retained in the replica panel. Choose a version and synchronize again. Ordinary editing is blocked until its stored conflict is resolved.

Once a record has been sent to another store, its project and sharing scope are fixed. To withdraw or move it, use the panel's explicit deletion control and create a new record under the desired scope. Deletion removes that fact's current and revision content and propagates a tombstone; a stale concurrent edit cannot restore it. Audit records, unrelated candidates, exports, and backups have separate retention. No physical SSD erasure is claimed.

**Revoke** on the receiving store immediately rejects the replica credential. **Stop** on the initiating side only stops its local connection; also revoke at the receiver. Re-pair with a fresh code when restoring intentional access. Ordinary remote-search credentials cannot invoke the replication API.

## Maintain and recover

Synchronization metadata and imported facts commit in the same SQLite transaction, so the existing consistent database backup includes them. The full private directory also contains TLS files. Preserve it as one unit; do not run a copied backup as another live store with the same identity. The original JSON export contains facts, not connection secrets or the replica ledger.

Use the original LAN certificate renewal/address-change process, verify the new fingerprint, and re-pair connections. A wrong certificate, revoked token, connection failure, or version collision retains local data and reports an error; retries use persisted backoff. No missing response is a successful sync.

## Observed scope

macOS acceptance uses real HTTP/HTTPS, two independent stores, actual CLI/MCP processes, offline conflict/deletion/restart checks, and a live Codex model turn. Cursor's MCP manager discovers the tools, but its model conversation remains blocked by local sign-in and account usage limits. A physical second device and native Windows/Linux operation remain unaccepted. There is no hosted cloud or scheduler. Keyword retrieval and local sentence extraction retain their existing behavior.
