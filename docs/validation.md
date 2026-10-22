# Validation

## Local prototype observations

The console was built and operated locally on October 22, 2026. Browser checks covered:

- Create, edit, search, favorite, archive, restore, and persistence after reload.
- Candidate review and preserving existing and newly scoped statements.
- Keyword retrieval with source and context preview.
- Sharing-disabled and incorrect-pairing-code errors, followed by simulated pairing.
- Simulated tool permission changes and pause/resume.
- Valid and invalid JSON import, archive/provenance/version preservation, export preview, and clipboard JSON readback.
- Independent tab, type, project, and search filters.
- All nine page headings and navigation paths.
- Desktop emulation at 1440 x 1040 and narrow emulation at 390 x 844, with document widths no greater than the viewport in the checked pages.

The Koder-first refinement also checked order across the overview, access page, and picker. Pausing Koder and reloading kept its first position and saved read-only setting. Its starting configuration was restored after that check. Catalog merge assertions checked order, existing state, permissions, use counts, custom tools, uniqueness, and input preservation.

An independent source/visual review of the earlier prototype found two interaction defects: imported archived facts became active, and type filters replaced the selected view. Both were corrected, checked in the browser, and accepted by a scoped source re-review. This was not independent whole-product runtime acceptance.

The four screenshots in this repository are captures of the running prototype. The interface is Chinese; the public documentation is English. The public source preserves the checked interface files, while the publication package excludes local paths and internal handoff records.

## Repository checks

Build locally with:

```sh
npm ci
npm run build
```

The GitHub build workflow reports its own execution result. A successful workflow validates dependency installation and compilation, not memory-service or device behavior.

## Unverified boundaries

Real adapters, databases, automatic extraction, embeddings, authenticated network synchronization, encryption, physical devices, cross-platform application packaging, and real CI memory access remain unimplemented or unverified. No claim of production readiness is made.

The original in-app browser did not produce a confirmed file-download event. Export preview and clipboard JSON were verified; native download completion remains unverified.

The 31.8% example compares 88,000 and 60,000 tokens. It is not measured savings. Real evaluation needs fixed tasks, model/settings, recall labels, applicable scopes, and total extraction/index/retrieval/injection costs.
