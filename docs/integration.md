# Memory-service integration

This is a design contract for future implementation, not an existing API.

A shared memory service should own identity, project scope, facts, provenance, lifecycle, versions, and revocation. Skill, MCP, and CLI entry points should call that authority rather than each maintaining a separate record of truth.

| Proposed operation | Responsibility |
| --- | --- |
| `memory.search` | Return authorized facts with source and selection reasons |
| `memory.propose` | Submit candidate facts with evidence and applicable scope |
| `memory.feedback` | Record usefulness, corrections, expiration, and retrieval failures |

Useful fact fields include a stable ID, owner, content, type, project, provenance reference, scope, confirmation state, revision, timestamps, and conflict/supersession references.

## Tool adapters

Verify exact tool names, versions, supported loading mechanisms, and permission behavior before configuring an adapter. Test one actual write in A and recall in B, including the source and applicable scope. The labels in this console do not prove protocol compatibility.

Koder CLI is a distinct target from Koder Open CLI. This repository does not modify either runtime. A CI integration should use project-scoped, read-only access by default, with enforcement in the service.

## LAN sharing

Use an authenticated service or an explicit replication protocol. Avoid uncontrolled concurrent writes to a database file shared between computers. Device trust, scope, revocation, offline work, version conflicts, recovery, and actual synchronization receipts need implementation and tests.

Memory sharing does not grant permission to execute a remembered command. Keep API keys, session secrets, pending approvals, and device execution grants outside the shared library.

## Evidence needed

Record actual adapter calls, service results, durable state, retrieval responses, device identity, and recovery outcomes. Browser settings, screenshots, source checks, and a successful build establish only their stated scope.
