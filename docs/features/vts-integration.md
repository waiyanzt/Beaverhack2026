# VTube Studio Integration

VTube Studio integration is owned by the Electron main process service layer and exposed to the renderer only through typed preload IPC methods.

## Implemented Surface

Current VTS support lives in:

- `electron/src/main/services/vts/vts.service.ts`
- `electron/src/main/ipc/vts.ipc.ts`
- `electron/src/preload/index.ts`
- `electron/src/renderer/hooks/useVTS.ts`
- `electron/src/renderer/components/HotkeyMapper.tsx`
- `electron/src/renderer/components/StatusPanel.tsx`

The implemented flow is:

1. Renderer loads saved VTS host/port/plugin metadata through `vts:get-status`.
2. User connects with `vts:connect`.
3. Main process opens a WebSocket to the VTube Studio public API.
4. User authenticates through `vts:authenticate`, which requests an API token and then exchanges it for an authenticated session.
5. Renderer can fetch current-model hotkeys through `vts:get-hotkeys`.
6. Renderer can manually test a hotkey through `vts:trigger-hotkey`.

## Runtime Contracts

Implemented IPC channels:

- `vts:get-status`
- `vts:connect`
- `vts:disconnect`
- `vts:authenticate`
- `vts:get-hotkeys`
- `vts:trigger-hotkey`

All VTS IPC handlers validate renderer input with Zod and return typed success/error results without exposing secrets.

## Settings

The app currently persists non-secret VTS connection metadata:

- `host`
- `port`
- `pluginName`
- `pluginDeveloper`

These values are stored through the main-process settings service and are returned in VTS status responses so the renderer can prefill the connection form.

The authentication token is not exposed to the renderer.

## Current Limitations

- The current slice supports connection, authentication, current-model hotkey listing, and manual hotkey triggering.
- VTS parameter writes and automation-pipeline execution are not wired to the VTS service yet.
- Packaging verification currently depends on network access for `electron-builder` to download Electron artifacts in this environment.
