# Release guide

The initial publication is version 0.1.0 and is marked as a prerelease prototype.

From a clean checkout with Node.js 22.12 or newer, npm, Python 3, and Git:

```sh
npm ci
npm run build
python3 scripts/package_release.py
```

The script requires a clean committed tree. It packages tracked source, the complete portable skill, and the built static preview. Each archive has a stable root folder and the relevant license notices. It verifies ZIP integrity, writes SHA256SUMS, and records the source commit in build-info.json. Outputs are in the ignored release/ directory.

Before publishing, check the source and preview artifacts, documentation links, asset licensing, and build result. Open the prebuilt preview through a loopback static server. Tag the same commit used by build-info.json, publish the verified archives with their checksums, and identify the release as a prototype until real-service acceptance exists.

A successful build or archive check does not establish database, adapter, authentication, cross-device synchronization, or measured recall/cost behavior. Release notes should state those boundaries.
