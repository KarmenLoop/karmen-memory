# Release guide

Version 0.3.0 is a local service alpha. Preserve v0.1.0 as the historical prototype.

From a clean committed checkout with Node 22.16+, npm, OpenSSL, Python 3, and Git:

```sh
npm ci
npm test
npm run build
python3 scripts/package_release.py
```

Packaging includes tracked source, each complete portable skill, and a runtime archive with the built interface plus service source. The runtime requires `npm ci` and `npm start`; it is not a standalone static website. Outputs under ignored `release/` include SHA256SUMS and build-info.json with the exact commit. Archives are checked for ZIP integrity.

Before publishing, extract the runtime into an isolated directory, start it with an isolated `KARMEN_MEMORY_HOME`, and complete creation/retrieval through the service. Verify private runtime data, credentials, local paths, logs, and test databases are absent from all archives. Check notices, docs, CI, and screenshots. Publish only the packages for the tagged commit; read back downloads and compare hashes.

Release notes distinguish real storage/API/CLI/MCP/local TLS evidence from installed native hosts, physical computers, platform packages, semantic accuracy, and model savings. A prerelease and successful CI do not establish those untested outcomes.
