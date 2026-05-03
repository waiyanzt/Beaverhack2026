# Shared

Shared types and constants between main process, preload, and renderer.

## Purpose

Centralize IPC channel names and type definitions that are used across process boundaries. Ensures consistency and type safety for all inter-process communication.

## Key Files

- `channels.ts` — IPC channel name constants and type definition. Channels follow `domain:operation` format.

## Architecture & Patterns

**IPC Channels**
- `GetAppVersion` → `"app:get-version"` — Fetch application version from main process
- `ModelTestConnection` → `"model:test-connection"` — Test model provider connectivity
- `ModelListProviders` → `"model:list-providers"` — List available model providers
- `ModelSetProvider` → `"model:set-provider"` — Set active model provider
- `VtsGetHotkeys` → `"vts:get-hotkeys"` — Fetch VTube Studio hotkeys

**Type Safety**
- `IpcChannels` object holds all channel constants as const values
- `IpcChannel` type exported as union of all channel values
- Enables TypeScript autocomplete in renderer/main when calling `ipcRenderer.invoke(channel)`

## Conventions

- Channel names use kebab-case operation names
- Domain comes first (app, model, vts, obs)
- Constants use PascalCase (GetAppVersion)
- String values use snake_case pattern with colon separator

## Gotchas & Notes

- Adding new IPC channel requires: update `channels.ts`, register handler in main process (`src/main/ipc`), expose in preload bridge, update TypeScript declaration in renderer, implement caller in renderer component/hook.
- These are invoke channels (request-response), not send channels (fire-and-forget).
