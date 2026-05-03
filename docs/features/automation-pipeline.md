# Automation Pipeline

The canonical automation flow is:

`ObservationBuilder -> PromptBuilder -> ModelRouter -> ActionPlanParser -> ActionValidator -> ActionExecutor`

The dashboard model monitor is a development visibility loop, not the canonical action executor. It starts the selected capture sources, sends rolling 10-second camera/screen/audio media windows through `ModelRouter` every second when no previous request is in flight, and prints model responses in the renderer. It does not execute returned actions; production model-generated actions still must pass through validation and execution.

See [SPEC.md](../../SPEC.md) for the full contract.

## Implemented Model-Control Slice

The Electron main process now builds a typed model-control payload before each automation run.

That payload includes:

- VTube Studio connection/authentication state
- current VTS model name
- cached VTS hotkeys as `{ id, name }`
- OBS connection state
- current OBS scene
- OBS live/recording state
- scene/source visibility inventory
- policy `allowedActions`
- recent actions and active cooldowns
- recent model action plans, kept in a transient 10-entry sliding window with the full parsed `ActionPlan`, action reasons, safety assessment, and execution results

The payload is serialized by `PromptBuilderService` and sent through `ModelRouterService`, then parsed, validated, and optionally executed by `PipelineService`.

`ModelActionMemoryService` owns the short-term model action memory in the Electron main process. The canonical automation pipeline records each parsed plan after review/execution, and the dashboard model monitor records returned plans as `not_executed` because that development loop never runs actions directly. The next prompt includes this memory so providers can make context-aware choices, such as continuing a laugh reaction when the latest observation still supports it, without mechanically repeating prior actions.

Noop decisions are also represented in the compact `recentActions` history. This keeps the prompt easy to inspect while preserving the full prior plan JSON in `recentModelActions`.

## Current Execution Rules

- `vts.trigger_hotkey` can execute immediately when the hotkey is currently available and not cooling down.
- `obs.set_scene` and `obs.set_source_visibility` are surfaced to the model and validated, but they currently stay in `confirmation_required` until a confirmation workflow is added.
- `vts.set_parameter` remains unsupported in execution.
- `overlay.message`, `log.event`, and `noop` are accepted as low-risk local actions.

## Operational Entry Point

A manual entry point is exposed over IPC at `automation:analyze-now` and through the renderer Manual Control panel.

- Dry run sends the model-control payload and returns reviewed action results without executing approved actions.
- Full run executes only actions that pass validation and do not require confirmation.
