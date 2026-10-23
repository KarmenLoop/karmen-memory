# Getting started

Use Node 22.16+, npm, and OpenSSL for optional LAN setup. Run `npm ci`, `npm run build`, then `npm start`. Open `http://127.0.0.1:4318`. Development uses `npm run dev -- --port 5186`, with the same service on 4318.

## First fact and second client

1. Create a memory with title, fact, type, exact project, evidence, and local/shared scope. The saved record gets an ID and revision 1.
2. Edit it. The current record advances to revision 2 and the prior snapshot remains in its history. Archive/restore changes retrieval visibility rather than deleting it.
3. Open Retrieval and search words from the fact. Check the ID, source, project, matched terms, and revision in the context.
4. In Agent access create a read-only credential for that project. Save its one-time token privately and point `KARMEN_MEMORY_TOKEN_FILE` at it. Run the [CLI or MCP bridge](integration.md), then compare the same ID.
5. A read/write credential can propose or extract candidates. Review them in Extraction before they participate in retrieval. Review can edit their scope or replace a same-project old fact while preserving its history.

Project names match exactly. A credential scoped to one project cannot read a different project's facts or general facts. Use `*` only when all-project access is intended. A credential request is an observed request, not proof of installed host integration.

## Storage and backup

The default private data directory is `~/.karmen-memory`. Set `KARMEN_MEMORY_HOME` before startup to use another directory. Keep one service process per directory and use local storage, not a network-mounted SQLite file.

Settings offers:

- **JSON export:** current facts and evidence, including archived facts. Credentials and full revision history are excluded.
- **JSON import:** validates the entire envelope before a transaction, skips identical bodies within a project, and assigns new IDs. Files are limited to 2 MB and 5,000 records. v0.1.0 prototype exports are accepted; inspect synthetic records before confirming.
- **SQLite snapshot:** a consistent database backup, also saved under the data directory's `backups/`. It contains facts, candidates, complete revisions, audit, evaluation samples, settings, and credential hashes. Treat it as private data.

To restore a full snapshot:

1. Stop the service and verify that it has exited.
2. Move the existing data directory to a dated private backup location. This preserves the database and any WAL/SHM files together; do not discard a live WAL.
3. Create a new private data directory and copy the desired snapshot to `memory.sqlite`, with mode `0600` on Unix.
4. Start with `KARMEN_MEMORY_HOME` pointing to the new directory. Inspect facts, revisions, and access settings before re-enabling LAN. A backup may contain hashes of previously valid credentials; revoke access that should no longer remain valid.

JSON import is additive and is not an exact full-database restore. Moving an older application over a newer database is not a supported schema downgrade.

## Offline behavior and limits

Local facts, lexical retrieval, rule extraction, review, and backup work without internet access. LAN clients need the primary service available; this release has no offline replica. No model or paid API is called. Native installed-host behavior, physical-device LAN use, Mac packaging, Windows runtime, semantic accuracy, and token savings require separate validation.
