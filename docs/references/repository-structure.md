# Repository Structure

```text
.
|-- AGENTS.md
|-- README.md
|-- SPEC.md
|-- docs/
|   |-- architecture.md
|   |-- setup.md
|   |-- security.md
|   |-- apps/
|   |-- features/
|   |-- references/
|   |-- standards/
|   `-- state/
|-- electron/
|   |-- package.json
|   |-- electron-builder.yml
|   |-- src/
|   |   |-- main/
|   |   |-- preload/
|   |   |-- renderer/
|   |   `-- shared/
|   `-- tests/
|-- models/
|-- assets/
|-- samples/
|-- scripts/
|-- apps/
`-- packages/
```

## Intent By Directory

- `electron/`: the shipped desktop app
- `docs/`: source-of-truth documentation and operating guidance
- `models/`: prompts and provider notes
- `assets/`: stream-facing art assets and repo visuals
- `samples/`: curated local media for verification and demos
- `scripts/`: repo-level shell helpers
- `apps/`: future non-electron applications
- `packages/`: future shared libraries

## Notable Generated Or Local-Only Paths

These should not be committed as source artifacts:

- `electron/dist/`
- `electron/release/`
- `electron/node_modules/`
- `node_modules/`
