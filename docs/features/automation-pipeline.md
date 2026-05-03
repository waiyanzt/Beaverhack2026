# Automation Pipeline

The canonical automation flow is:

`ObservationBuilder -> PromptBuilder -> ModelRouter -> ActionPlanParser -> ActionValidator -> ActionExecutor`

The dashboard model monitor now uses the canonical pipeline for live VTS automation. It starts the selected capture sources, waits for fresh buffered camera/audio clips, sends the latest webcam clip through `PipelineService`, and executes only VTS-safe approved actions. OBS actions are intentionally excluded from this live path for now.

See [SPEC.md](../../SPEC.md) for the full contract.

## Implemented Model-Control Slice

The Electron main process now builds a typed model-control payload before each automation run.

That payload includes:

- VTube Studio connection/authentication state
- current VTS model name
- cached VTS hotkeys as `{ id, name }`
- VTS readiness state, `readyForAutomation`, a versioned automation catalog, and the current safe-auto candidate list
- OBS connection state
- current OBS scene
- OBS live/recording state
- scene/source visibility inventory
- policy `allowedActions`
- recent actions and active cooldowns
- recent model action plans, kept in a transient 10-entry sliding window with the full parsed `ActionPlan`, action reasons, safety assessment, and execution results

Recent action history now carries both:

- a stable machine target key such as `vts.hotkey:<id>` for cooldown/policy logic
- a human-readable `label` such as `VTS hotkey: Wave` for logs and review surfaces

For manual text-only runs, the payload is serialized by `PromptBuilderService` and sent through `ModelRouterService`, then parsed, validated, and optionally executed by `PipelineService`.

For live camera/audio runs, `PipelineService` can also attach the latest buffered webcam clip plus synchronized audio as an MP4 `video_url` input while keeping the same parse/validate/execute flow. That live path now trims prompt history aggressively and excludes noop-only memory so the current clip remains the primary evidence instead of being drowned out by prior identical monitor outputs.

`ModelActionMemoryService` owns the short-term model action memory in the Electron main process. The canonical automation pipeline records each parsed plan after review/execution, and the dashboard model monitor records returned plans as `not_executed` because that development loop never runs actions directly. The next prompt includes this memory so providers can make context-aware choices, such as continuing a laugh reaction when the latest observation still supports it, without mechanically repeating prior actions.

Noop decisions are also represented in the compact `recentActions` history. This keeps the prompt easy to inspect while preserving the full prior plan JSON in `recentModelActions`.

## Current Execution Rules

- `vts.trigger_hotkey` now executes only when the model returns a current `catalogId` from `services.vts.automationCatalog.candidates` and the local validator confirms:
  - VTS readiness is `ready`
  - the catalog version is current
  - the selected candidate is still present
  - the candidate is classified as `safe_auto`
  - the action is not cooling down or repeat-suppressed
- `obs.set_scene` and `obs.set_source_visibility` are surfaced to the model and validated, but they currently stay in `confirmation_required` until a confirmation workflow is added.
- `vts.set_parameter` remains unsupported in execution.
- `overlay.message`, `log.event`, and `noop` are accepted as low-risk local actions.

## Operational Entry Point

A manual entry point is exposed over IPC at `automation:analyze-now` and through the renderer Manual Control panel.

- Dry run sends the model-control payload and returns reviewed action results without executing approved actions.
- Full run executes only actions that pass validation and do not require confirmation.
- Manual renderer automation requests now default to live capture input with OBS actions disabled so operators can exercise the same VTS-only path on demand.
