# v0.3.0 acceptance extension

The existing v0.2.0 acceptance record below is retained. New checks exercise offline replicas, same-database transactions, scoped transfer, conflicts, deletion versus stale edits, credential revocation, and service restart. See [replica setup and scope](replication.en.md). Physical two-device and Cursor model conversation acceptance remain outstanding.

# Validation record

## 0.2.0 local service alpha — October 23, 2026

Author-run checks on macOS arm64, Node 22.23.2, SQLite 3.51.3, Vite 7.3.7, and the Codex in-app browser. These are local implementation and runtime checks, not independent product or installed-host acceptance. Test databases use isolated temporary directories; public packages exclude all runtime data.

### Automated integration

Command: `npm test` (repository root). Result: exit 0; **20 business subtests**, 21 Node test records including the parent, zero failures. Uses actual SQLite, HTTP, TLS, subprocess CLI, and MCP stdio:

- Empty database has no sample memories, credentials, activity, or connected status.
- Owner session, CSRF, Origin, Host, and unauthenticated denial.
- Create/edit with immutable history; stale revisions conflict.
- Exact project scope; read-only tool writes denied; CI policy and named-project limits.
- Another client retrieves the same approved ID and cannot retrieve a different project.
- Tool proposals stay pending; idempotent replay returns the original ID; different-body key reuse conflicts.
- Approval makes a candidate retrievable; repeated review conflicts.
- Rule extraction retains sentence evidence and deduplicates repeated input.
- Superseding archives the old version and links its successor in a transaction.
- Archive/restore/favorite remain durable.
- Invalid import makes no partial change; valid JSON restores to another database with new IDs and deduplicates on repeat.
- Feedback scope and evaluation cost-field validation.
- Existing CI, paused, and revoked credentials are enforced on subsequent calls.
- Actual CLI JSON output, matching ID, denied write, and nonzero failure exit.
- MCP initialization, listing, actual search, and tool-error response.
- Actual HTTPS certificate, paired-device requirement, one-use pairing, local-only exclusion, five-attempt lock, and revocation.
- Pairing expiration uses a controlled Date clock; real pairing CLI saves a mode-0600 profile and refuses overwrite.
- SQLite snapshot passes `PRAGMA integrity_check`, preserves revisions and audit.
- Closing/restarting the actual service preserves facts, revisions, candidates, credentials, settings, instance ID, and audit.

The tests do not infer model quality or physical-device interoperability from local clients. Pair-code time expiration is deterministic clock-controlled testing; actual TLS transport and CLI pairing are separate real calls.

### Browser observations

At `http://127.0.0.1:5186`, backed by an isolated local SQLite service:

- Created synthetic `Console QA` fact through the real form. ID `d895ff0c-4aa5-4fd5-a1fe-9e47279c5aaa`.
- Edited the fact, inspected source and revision history, and retrieved the same ID at r2.
- Supplied explicit context, generated a persisted candidate, edited its title, approved it, and observed both facts after browser reload.
- Restarted the preview service process and retained both records. Exercised mobile keyboard favorite, archive at r4, restore at r5, history, and Escape; the 390px detail drawer stayed within the viewport.
- Checked all nine routes at 1440×1040 and 390×844; no document horizontal overflow after repair. Wide tables scroll within their container. Navigation was also exercised with Enter.
- Koder, Koder CLI, and Cursor remain first; no credential is marked as observed before an actual request.
- Browser console error log was empty during the route checks.

Current screenshots are actual service-backed pages with synthetic acceptance data. Credential issue/revocation, CI, and TLS were verified by integration requests; those checks do not substitute for testing native installed-host setup through its own UI. JSON/download bytes and snapshots are verified through HTTP; a browser download request alone is not treated as saved-file evidence.

### Failures found and corrected

The first integration run failed because credential statistics updates used an insert that omitted the stored token hash. Updating only the credential data column corrected the requests; the complete suite then passed. A Host-header assertion initially used a fetch implementation that did not send the supplied Host; the test now uses raw HTTP and proves rejection with the actual header.

The first narrow-screen check found a memory-table helper label whose absolute positioning escaped the scroll container. Positioning the container and constraining overflow removed document overflow; all nine routes were checked again. The detail metadata also needed explicit vertical rows and padding after replacing the prototype markup; desktop and narrow drawer checks confirmed the correction. Fast pointer clicks during sidebar transitions produced wrong navigation in the automation; keyboard activation and fresh route headings were used for the complete responsive check.

### Build and delivery

`npm run build` passed after the service-backed UI conversion. The runtime memory skill passed the skill frontmatter/name validator. The CI workflow now runs integration tests before the build. A separate clean directory completed `npm ci` with exit 0. `node scripts/verify_runtime.mjs CLEAN_DIRECTORY` returned PASS after serving the built assets, creating and retrieving the same ID, and restarting the actual process with the fact retained. Sanitized raw checks are in [evidence](evidence/clean-runtime.json), alongside [service tests](evidence/service-tests.tap) and [browser layouts](evidence/browser-layout.json). GitHub CI and release readback are verified separately for the final commit.

### Not yet accepted

- Actual installed Koder, Koder CLI, Cursor, or other native host integration.
- Two physical computers, firewall routing, certificate changes after a host IP change.
- Offline replication or caching on another computer.
- Native Mac packaging and Windows runtime.
- Model extraction, semantic/vector recall, accuracy benchmarks, or savings claims.
- Independent whole-product/security review and production operation.

## Historical v0.1.0 evidence

The original browser-only prototype had localStorage CRUD, candidate examples, keyword lookup, simulated credentials/devices, and example analytics. Its nine desktop/mobile routes and Koder-first persistence were checked at that time. These historical observations do not prove the new service behavior; the v0.2.0 checks above supply the new evidence. The old 31.8% figure and fixed pairing code were examples and have been removed from the service-backed interface.
