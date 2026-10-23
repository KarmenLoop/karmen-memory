> Historical v0.2.0 plan, retained for provenance. v0.3.0 adds [offline replicas](replication.en.md).

# Local memory service implementation

## Scope and decisions

The October 23 request replaces simulated console behavior with observable local operations. Koder, Koder CLI, and Cursor remain first in the catalog. The console, CLI, and MCP bridge use one memory service and one SQLite database. They do not change an installed agent's execution engine, approval authority, account, or configuration.

The existing related `koder-shared-memory` repository supplies a skill contract, not a database server. This repository therefore adds the missing standalone storage service. Node's built-in SQLite driver avoids a native npm dependency; Node 22.16 or newer is required and the driver remains experimental on Node 22.

## Runtime and ownership

```text
Browser console -- same-origin owner session --> loopback HTTP service
CLI / MCP bridge -- scoped bearer credential --> same service
LAN CLI / bridge -- pinned private CA + credential --> optional HTTPS listener
                                                   |
                                              SQLite database
```

The service owns validation, project visibility, review decisions, revisions, access removal, and activity. Browser state contains only navigation, filters, and unsaved forms. SQLite uses transactions, WAL, an application schema version, and private filesystem permissions. It is not encrypted at rest; operating-system disk protection remains necessary.

The loopback console is available to the logged-in operating-system user. It issues an HttpOnly SameSite cookie and checks Host, Origin, and a session CSRF token. Tool credentials are random, shown once, and stored only as hashes. Tool writes create review candidates. CI requires a named project and read-only access. Pausing or revoking a credential is enforced on the next request. LAN credentials cannot read facts marked local-only.

LAN is disabled initially. Enabling generates a private self-signed certificate with the local OpenSSL executable and starts an HTTPS listener. Pairing uses a short-lived one-use random code with bounded attempts; the client must trust the certificate through an explicitly copied CA file. Closing sharing closes the listener. This is shared access to a primary service, not offline database replication.

## Page and acceptance map

| Page | Actual source and operation | Acceptance |
| --- | --- | --- |
| Overview | Database counts, service health, observed credential requests | Empty install has zero facts and zero connections; counters change after requests |
| Memory library | CRUD, optimistic revisions, archive, favorites, history | Create/edit/archive/restore; stale edit rejected; restart preserves records |
| Retrieval | Project-filtered multilingual lexical ranking with source and score | Another credential finds the same approved ID; other projects and local-only LAN facts stay hidden |
| Agent access | Issue, pause, rotate/revoke scoped credentials; generated CLI/MCP setup | Requests require credentials; read-only writes and revoked requests fail |
| LAN devices | Actual listener, expiring pairing codes, paired credentials and last request | TLS pairing and remote-policy checks on independent local clients; two physical computers remain a separate test |
| Extraction | Deterministic sentence extraction, duplicate checking, evidence, review | Input produces persisted candidates; review creates a fact or rejects; conflicting updates require a decision |
| Activity | Persisted operations and denied credential requests | No seeded events; successful and refused requests have actual records |
| Evaluation | Observed retrieval counts/latency and explicitly entered benchmark samples | No claimed savings without samples; totals include extraction/index/retrieval/context costs |
| Settings | Actual JSON backup/import, SQLite snapshot, service details | Invalid import rolls back; exported data can restore into an isolated database |

## Public contracts

- Owner endpoints: `/api/session`, `/api/state`, `/api/memories`, `/api/candidates`, `/api/extract`, `/api/credentials`, `/api/search`, `/api/settings`, `/api/lan`, `/api/pairing`, `/api/export`, `/api/import`, `/api/backup`, `/api/evaluations`.
- Tool endpoints: `/v1/search`, `/v1/propose`, `/v1/extract`, `/v1/feedback`, `/v1/status`. LAN pairing: `/v1/pair`.
- A fact has a stable ID, title, body, type, project, source evidence, scope, lifecycle status, revision, timestamps, and optional superseded ID. Revisions are immutable snapshots. Mutations and their audit entry commit together.
- Candidate approval accepts edits and an explicit append or supersede choice. Unapproved text never enters retrieval.
- Search is lexical, not an embedding model. Extraction uses local rules, not an undocumented AI provider. Neither requires paid APIs or sends text to a third party.
- JSON imports validate the entire envelope before a transaction and allocate new IDs. Legacy prototype exports are accepted as explicitly imported facts; browser data is never silently promoted.

## Delivery and limits

Implement storage and contracts, then CLI/MCP and TLS, then connect every page. Test isolated SQLite storage, restart, transaction rollback, stale revisions, scope enforcement, read-only and revoked credentials, pairing expiration/use limits, CLI, MCP messages, and the actual browser path at desktop and narrow widths. Record failures and corrections in `docs/validation.md`.

Native Koder/Koder CLI integration, installed Cursor configuration, physical LAN devices, desktop packaging, semantic recall accuracy, and model token savings require their own runtime evidence. The console must identify these limits rather than show a fake connected badge. The existing v0.1.0 release remains a historical prototype; updated source and documentation describe the new service version.
