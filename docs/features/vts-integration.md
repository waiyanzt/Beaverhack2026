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

## Live Automation Flow

The live dashboard monitor now feeds fresh buffered webcam/audio input into the canonical automation pipeline and can execute approved `vts.trigger_hotkey` actions automatically.

That live path is:

1. Capture buffers finish a fresh webcam clip, optionally with matching audio.
2. `ModelMonitorService` invokes `PipelineService` with `useLatestCapture: true`.
3. `LiveCaptureInputService` converts the latest camera/audio buffer into a model-ready MP4 `video_url`.
4. `PromptBuilderService` combines that live media input with typed VTS service context.
5. `ActionValidatorService` blocks anything outside the current VTS policy surface.
6. `ActionExecutorService` triggers the approved VTS hotkey through `VtsService`.

## Activation And Retry

VTube Studio activation is now handled from the Electron main process service layer instead of relying only on manual renderer clicks.

Current behavior:

- The app attempts VTS activation on startup using the saved host, port, plugin name, and plugin developer values.
- If VTube Studio is not running yet, the app schedules automatic retry attempts in the background.
- Manual retry is exposed in the renderer through the runtime Status view and the VTube Studio panel.
- Within the same app session, reconnect flows reuse the cached VTS authentication token before requesting a fresh token again.

## Current Limitations

- The current slice supports connection, authentication, current-model hotkey listing, manual hotkey triggering, and automation-pipeline hotkey execution.
- The live automation path intentionally disables OBS actions even when OBS is connected.
- The automation pipeline now sends VTS connection state, current model name, and cached hotkeys to the model as structured capability data.
- VTS parameter writes are still not wired to the VTS service yet.
- Authentication tokens are not persisted across full app restarts yet, so a fresh launch may still require VTube Studio approval before automatic hotkey execution is available.
- Packaging verification currently depends on network access for `electron-builder` to download Electron artifacts in this environment.
