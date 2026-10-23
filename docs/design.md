# Console design

The console keeps the existing light, moss-green workspace and nine routes. Koder, Koder CLI, and Cursor stay first across the overview and access page. Actual service state replaces sample counters and connections.

The left navigation owns workspace sections; the top bar owns global fact filtering and candidate notifications. The main workspace shows the task and its current data. Detail drawers show evidence, scope, revision history, and archive/restore. Dialogs handle edits, review decisions, credential issue/revocation, pairing, and import confirmation.

Database counts and observed requests are distinguished from host integration. A fresh database is empty. Configured credentials remain “waiting for first request” until the service receives one. Synthetic acceptance records name their source explicitly.

Memory fields are editable before approval. Potentially related facts remain visible, and a person chooses an independent scoped fact or replacement. A replacement archives the old record and links the new ID. Stale revisions return an actionable conflict rather than silently overwriting a newer version.

Loading and connection failures have a retry entry. Server errors remain visible with the form open. Mutating forms disable during a request. Native dialogs contain focus and support Escape. Narrow layouts preserve reachable primary actions and use contained horizontal scrolling for wide data tables. Token and certificate blocks wrap without widening the document.

Extraction and retrieval state their actual methods. Evaluation separates observed lexical query metrics from user-recorded task samples. The total token comparison includes context, extraction, indexing, and retrieval; no savings number appears without samples.

See [Implementation plan](implementation-plan.md) for the page-to-contract map, [Integration](integration.md) for permissions, and [Validation](validation.md) for actual evidence.

The [v0.1.1 capture](images/overview-desktop-v0.1.1.png) is retained as historical prototype evidence. The README uses the current service-backed capture.
