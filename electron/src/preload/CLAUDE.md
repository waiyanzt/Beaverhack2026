# Preload

Preload script that bridges renderer process to main process via IPC, with full context isolation.

## Purpose

Expose a controlled, typed API to the renderer (`window.desktop`) that mediate all communication with the main process. Runs with full Node.js access but only exposes approved methods to renderer.

## Key Files

- `index.ts` — Preload script entry. Defines `desktopApi` object and exposes it via contextBridge.

## Architecture & Patterns

**API Exposure**
- `contextBridge.exposeInMainWorld("desktop", desktopApi)` makes API available as `window.desktop` in renderer
- Each method wraps an IPC invoke call with error handling
- All errors caught and safe defaults returned (e.g., empty array, "unknown")

**Methods**
- `getAppVersion()` — Returns app version string
- `getHotkeys()` — Returns array of VTS hotkey objects (untyped in preload, typed in renderer with Zod)

**Error Handling**
- try-catch wraps each IPC call
- Errors logged to console but not exposed to renderer (security)
- Default values returned on error (e.g., "unknown", [])

## Dependencies & Integrations

- `electron.contextBridge` — Exposes API to renderer safely
- `electron.ipcRenderer` — Invokes main process handlers
- `IpcChannels` from shared — Type-safe channel names

## Conventions

- API methods are async (all IPC calls are async)
- Method names match handler intent (getAppVersion, getHotkeys)
- Return type is `Promise<unknown>` in preload (typed in renderer via TypeScript declaration)
- One method per handler (no utility functions)

## Gotchas & Notes

- Preload runs with full Node.js access but must not expose privileged APIs (fs, require secrets, etc.)
- All renderer code that needs IPC must use `window.desktop` methods, never direct ipcRenderer
- Type definitions (`window.desktop` interface) live in renderer (`types/electron-api.d.ts`)
- Adding new preload method requires: create handler in main, add to desktopApi, update TypeScript declaration in renderer
