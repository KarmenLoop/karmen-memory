# Contributing

Thanks for helping make personal memory easier to inspect and manage.

For a larger change, open an issue describing the user problem and expected behavior. Keep the browser interface, memory service, device trust, and execution permissions separate.

## Local development

Use Node.js 22.16 or newer.

```sh
npm ci
npm test
npm run build
npm run dev -- --port 5186
```

For an interface change, check the actual task and the desktop and narrow-screen layouts. For a data change, check reload persistence, archive state, original source, version, and combined filters. Use synthetic data. Do not depend on a personal database, paid model, or logged-in agent.

## Pull requests

Describe the concrete problem, changed behavior, and checks you ran. Include a screenshot when it helps assess an interface change. Report remaining integration or platform limits separately from local results.

Keep changes focused. Use natural, concrete US English in commit messages, the repository description, and the README. The interface is currently Chinese; a new localization should identify which language was actually checked.

Never attach credentials, private conversations, browser storage exports containing personal information, or raw support logs. Report sensitive findings through [SECURITY.md](SECURITY.md).

Contributions are offered under this repository's Apache License 2.0. Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Documentation and release changes

Keep the English and Simplified Chinese entry pages and guides aligned. Explain the reader's actual task with project-specific examples. Use concrete English commit subjects. New ordinary filenames and versioned release assets use lowercase kebab-case without spaces; conventional README, LICENSE, SKILL, and metadata names remain unchanged. Before release, compare each package, version label, command, and current image with the documented behavior. Label diagrams, synthetic data, historical evidence, and unverified integrations accurately.
