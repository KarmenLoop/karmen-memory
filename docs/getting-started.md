# Getting started

## Run the console

Install Node.js 22.12 or newer, clone the repository, and run:

```sh
npm ci
npm run dev -- --port 5186 --strictPort
```

Open `http://127.0.0.1:5186`. The preview binds to loopback. A different free port can be supplied with `--port`.

## Try a memory

1. Open the memory library and add a short fact with a type, project, and sharing scope.
2. Search for its title, edit it, and reload the page.
3. Favorite the fact, archive it, and find it under the archive tab.
4. Restore it when you want it available to the demonstration retrieval again.

The current browser stores these changes. Another browser profile or a different origin has its own storage.

## Review and retrieve

The candidate page includes ordinary proposals and a scope conflict. Review the evidence, accept or exclude a proposal, or keep both statements with an explicit scope. The example retrieval page uses local keyword matching and shows the selected context. It does not contact a model or embedding service.

## Explore tools and devices

Koder, Koder CLI, and Cursor lead the tool page and picker. The configuration drawer saves simulated access settings. It does not write to those tools' real configuration files.

LAN sharing starts disabled. In the demonstration, enable it before adding a device. The fixed code `246810` creates a simulated device; an incorrect code produces a visible error. No actual network pairing occurs.

## Export, import, and reset

Export opens a reviewable JSON preview. Copy the JSON or request a browser download. If the browser does not save a file, use the copy path. File-download completion was not confirmed in the original in-app-browser check.

Import accepts the prototype schema, at most 500 records, and files up to 1 MB. It adds records with new local IDs while preserving validated archive state, source, revision, and associated fields. This is additive import, not a replace-all restore.

Settings can restore the initial sample data after a confirmation. Export your own changes first if you want to keep them. Do not put personal data or credentials into this prototype.
