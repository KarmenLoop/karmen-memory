---
name: shared-memory-console
description: Design or extend an administration console for cross-agent personal memory, including provenance, candidate review, retrieval explanations, tool access, and trusted LAN devices.
---

# Shared Memory Console

Build a reviewable administration surface for one personal memory service. Keep memory ownership, project scope, source, revision, and confirmed versus candidate facts visible.

Before extending an existing implementation, inspect its memory service and identity contracts. Use the existing database authority and Core. Read [the page contract](references/page-contract.md) when designing a page or preparing a backend handoff.

Complete the user's requested surface with working navigation and observable interactions. Distinguish browser state, adapter configuration, actual service responses, and verified cross-tool behavior. Use sample data when no service is available, label it clearly, and state the integration work remaining.

For a shared-memory workflow, preserve this sequence: contextual input, extracted candidate, scope/conflict decision, confirmed fact, authorized retrieval, and use feedback. Keep original provenance and conflicting versions available until resolved. Editing a preference changes memory content; it does not grant execution authority.

For LAN pages, show local-only as the initial state, explicit device trust, sharing scope, version conflicts, offline behavior, and access removal. A mock switch or fixed demo code establishes no real connection. Keep API keys and execution grants outside shared memory.

Treat token savings and recall accuracy as measured only when a fixed task set, model configuration, cost accounting, and actual results are available. Otherwise present examples or evaluation targets.

Validate the visible primary path, empty and error states, keyboard focus, dialog exit, desktop and narrow layouts. Provide the preview location, source, observed checks, and remaining service integration boundaries.
