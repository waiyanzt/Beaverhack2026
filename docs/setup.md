# Setup

This guide is for contributors and operators preparing a local AuTuber build.

## Prerequisites

- Node.js 22+
- `pnpm` 10+
- OBS Studio if you want OBS integration
- VTube Studio if you want VTS integration
- a compatible model endpoint if you want live AI automation

## Install

```bash
pnpm install
```

## Run The App

```bash
pnpm dev
```

This starts the Electron renderer and main process through `electron-vite`.

## Production Build

```bash
pnpm build
```

That runs the Electron build and packages desktop artifacts through `electron-builder`.

## First-Run Operator Flow

1. Launch AuTuber.
2. Open the VTube Studio panel and connect/authenticate.
3. Refresh the VTS hotkey catalog.
4. Optionally connect OBS so scene/source state is available.
5. Configure the model provider.
6. Start the capture sources you want the model to observe.
7. Use `Analyze Now` or the live monitor to verify the automation loop.

## Environment Notes

- Root `.env.example` documents workspace-level placeholders.
- `electron/.env.example` is the app-specific template for local development.
- Do not commit live API keys, OBS passwords, or VTS tokens.

## Verification

From the repository root:

```bash
pnpm lint
pnpm test
pnpm build
```

If packaging fails in a restricted environment, note whether `electron-builder` was blocked from downloading or signing required assets.

## Related Docs

- [Commands](./references/commands.md)
- [Releases](./references/releases.md)
- [Architecture](./architecture.md)
