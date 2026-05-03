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
6. Renderer can fetch and regenerate the current catalog through `vts:get-catalog` and `vts:refresh-catalog`.
7. Renderer can persist or clear per-hotkey overrides through `vts:update-catalog-override`.
8. Renderer can manually test a hotkey through `vts:trigger-hotkey`.

## Runtime Contracts

Implemented IPC channels:

- `vts:get-status`
- `vts:connect`
- `vts:disconnect`
- `vts:authenticate`
- `vts:get-hotkeys`
- `vts:get-catalog`
- `vts:refresh-catalog`
- `vts:update-catalog-override`
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
5. `VtsService` exposes a readiness state plus a versioned automation catalog derived from the current model hotkeys.
6. `ActionValidatorService` accepts only `catalogId` selections from the current safe-auto catalog and blocks stale, unknown, or repeated entries.
7. `ActionExecutorService` resolves the current `catalogId -> hotkeyId` mapping locally and then triggers the approved hotkey through `VtsService`.

## Readiness And Catalog

VTube Studio automation now uses a local readiness/candidate layer instead of letting the model choose raw hotkey IDs directly.

`VtsService` tracks:

- readiness state
- `readyForAutomation`
- current model metadata
- raw hotkey inventory for the settings UI
- a versioned automation catalog
- generated hotkey classifications from the selected model provider
- per-hotkey manual overrides stored in app settings

The readiness state currently distinguishes:

- `not_running`
- `connecting`
- `unauthenticated`
- `authenticating`
- `no_model_loaded`
- `no_hotkeys`
- `catalog_building`
- `ready`

The automation catalog is regenerated from the current raw hotkey list. The generator sends those hotkeys through a classifier prompt, validates the JSON response, falls back to local heuristics when needed, and then applies any saved manual overrides for matching hotkeys only. Each entry gets:

- a stable `catalogId`
- the current underlying `hotkeyId`
- the raw hotkey name and description
- generated cue labels
- generated emote kind
- generated auto mode
- generated confidence
- effective deactivation behavior
- optional manual override values
- an effective classification source of `model`, `heuristic`, or `override`

The renderer `VTS Catalog` tab includes a management surface where the operator can:

- connect and authenticate VTube Studio
- refresh current model hotkeys
- force-regenerate catalog classifications from the current hotkey list
- inspect generated cue labels, emote kind, auto mode, and confidence for each hotkey
- override cue labels, emote kind, auto mode, confidence, and deactivation behavior for any individual hotkey
- clear an override to return that hotkey to generated behavior
- manually test any raw hotkey

## Deactivation Behavior

VTube Studio hotkeys are not assumed to auto-deactivate.

Each catalog entry now carries a local deactivation policy:

- `hasAutoDeactivate`
- `manualDeactivateAfterMs`

The default policy is:

- `hasAutoDeactivate = false`
- `manualDeactivateAfterMs = 5000`

That means AuTuber will locally retrigger the same hotkey after five seconds to turn it back off unless the operator explicitly marks that hotkey as self-resetting.

This policy is local app behavior only. The live model does not see or choose it. The model still returns only `catalogId`; the Electron main process decides whether a follow-up cleanup trigger is needed.

Only effective `safe_auto` entries are sent to the model as live automation candidates. Raw VTS hotkey IDs stay in the main process; the loop prompt receives the current `catalogId`, label, description, cue labels, emote kind, and catalog version.

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
- The automation pipeline now sends VTS connection state, current model name, and the smaller effective safe-auto catalog for model selection.
- VTS parameter writes are still not wired to the VTS service yet.
- Authentication tokens are not persisted across full app restarts yet, so a fresh launch may still require VTube Studio approval before automatic hotkey execution is available.
- Packaging verification currently depends on network access for `electron-builder` to download Electron artifacts in this environment.
