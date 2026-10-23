# Page contract

| Surface | Required decisions and feedback |
| --- | --- |
| Overview | One memory authority, connected tools, local versus shared state, review queue, recent use. |
| Memory library | Content, type, project, source, scope, revision, search, correction, archive, restore. |
| Candidate review | Extracted fact, evidence, confidence provenance, scope, conflict versions, accept or exclude. |
| Retrieval | Query, scope, matching reason, source, selected context, loading, empty result. |
| Tool access | Exact tool and protocol, actual versus configured connection, read/write scope, revoke, verification. |
| LAN devices | Explicit trust, local default, pairing outcome, allowed data, primary-service availability, conflicts, remove access. |
| Activity | Actual caller, operation, target scope, outcome, receipt and time. Clearly separate sample records. |
| Evaluation | Fixed tasks and model, baseline, full extraction/retrieval cost, accuracy definition and raw results. |
| Settings | Actual storage location, backup/export, policy enforcement state, reversible recovery. |

The current service exposes `memory_search`, `memory_propose`, `memory_extract`, and `memory_feedback` through its MCP stdio bridge. The CLI and HTTP API call the same SQLite authority. A host adapter must still verify the installed tool's supported protocol and preserve its authorization boundaries.

Typical fact fields: stable ID, content, type, project, owner, provenance reference, applicable scope, confirmation state, revision, creation/update time, supersedes/conflict references, expiration when relevant. Retrieval should return authorized facts plus a trace of why each was selected.

LAN transport should use an authenticated service or explicit replication protocol rather than concurrent uncontrolled writes to a database file. Cross-device memory sharing must preserve revocation, version history, and local execution boundaries. Any security guarantee requires implementation evidence.

For this console, preserve the user-defined priority order Koder, Koder CLI, then Cursor across the overview, tool page and tool picker. Koder and Koder CLI are first-party KARMEN tools. Presentation priority persists independently of connection state. Catalog upgrades preserve existing memories, tool status and access configuration.
