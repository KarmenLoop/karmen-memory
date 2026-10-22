# KARMEN Memory: prototype guide

English | [简体中文](tutorial.zh-CN.md) · [Project](../README.md)

This guide matches **v0.1.1**, a prerelease prototype.

## 1. Download and run

Choose the preview ZIP on the release page, or the source ZIP for source work. The portable design skill is a separate skill ZIP. Compare the complete local hash with the matching SHA256SUMS entry using shasum -a 256 on macOS or Get-FileHash -Algorithm SHA256 in PowerShell.

In the extracted karmen-memory-preview folder, use Python 3 to serve the prebuilt files:

```sh
python3 -m http.server 5187 --bind 127.0.0.1
```

Open http://127.0.0.1:5187 rather than double-clicking index.html. Source work needs Node 22.12+: run npm ci, npm run build, then npm run preview -- --port 5187 --strictPort.

## 2. Configure and try the workflow

No API key is needed. Create a synthetic memory with its type, project, and sharing scope; search, edit, and reload it. Favorite, archive, and restore it, checking each state. Review one proposal and one scope conflict on the candidate page.

## 3. Retrieval, import/export, and the skill

Retrieval shows context selected by local keywords. Inspect exported JSON before saving it. Imports allow up to 500 records and 1 MB and add records rather than replacing the library. Export before changing origin, port, or device, then confirm import at the new location.

The design skill is skills/shared-memory-console. Copy the whole folder into a new host-supported skill directory and load SKILL.md. It starts no database, network synchronization, or real adapter.

## 4. Troubleshoot and manage versions

Use another free port if occupied. A blank page often means the extracted web root is wrong. If records seem missing, check browser, port, and origin. Settings reset restores sample data, so export anything you want to retain first.

Export and inspect JSON before updating, retain the old preview directory, and verify the new package separately. Keep the latest export if rolling back. Ctrl+C stops the local server. Removing files does not clear browser localStorage; clear only the relevant origin through browser storage settings if intended.

[Apache-2.0](../LICENSE) · [NOTICE](../NOTICE) · [Third-party notices](../THIRD_PARTY_NOTICES.md)
