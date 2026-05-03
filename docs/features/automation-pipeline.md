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
- VTS readiness state, `readyForAutomation`, a versioned automation catalog, and the current user-managed safe-auto candidate list
- OBS connection state
- current OBS scene
- OBS live/recording state
- scene/source visibility inventory
- policy `allowedActions`
- recent actions and active cooldowns
- recent model action plans, kept in a transient 10-entry sliding window with the full parsed `ActionPlan`, action reasons, safety assessment, and execution results
- a compact `recentActionSummary` derived from recent VTS catalog actions for the live loop
- a compact `cooldownSummary` keyed by `catalogId` so the model does not have to infer cooldown state from prior blocked results

Recent action history now carries both:

- a stable machine target key such as `vts.catalog:<catalogId>` for cooldown/policy logic
- a human-readable `label` such as `VTS catalog: laugh` for logs and review surfaces

For manual text-only runs, the payload is serialized by `PromptBuilderService` and sent through `ModelRouterService`, then parsed, validated, and optionally executed by `PipelineService`.

For live camera/audio runs, `PipelineService` can attach either the latest sampled webcam frame as a low-latency `image_url` input or the latest buffered webcam clip plus synchronized audio as an MP4 `video_url` input while keeping the same parse/validate/execute flow. The dashboard monitor uses the latest-frame mode by default to avoid waiting for a completed video segment and to avoid ffmpeg muxing/transcoding on the critical path. Manual live analysis can still use the clip path when audio evidence is more important than reaction latency.

Live model prompts do not expose VTS hotkey names, catalog IDs, catalog candidates, raw hotkey IDs, recent catalog action IDs, or catalog-keyed cooldown summaries. The model sees only the operator-managed cue labels that are currently used by effective `safe_auto` VTS catalog entries and may return a `vts.trigger_hotkey` action with cue labels, confidence, visual evidence, action ID, and reason. `PipelineService` maps cue labels to exactly one current safe-auto catalog entry in the main process. If cue labels are unsupported, ambiguous, ignored (`idle`, `manual_request`, `unknown`), or do not map to exactly one safe-auto catalog entry, the action is normalized to `noop`.

The live path now also stops feeding full prior plans back into the model as decision evidence. Instead it keeps:

- filtered `recentActions`
- empty `recentModelActions`
- compact `recentActionSummary`
- explicit `cooldownSummary`

This keeps cooldown enforcement in the validator/executor layer instead of teaching the model to self-suppress based on prior blocked outputs.

The live model monitor reports stage timing separately. Provider request latency is measured only around `ModelRouter.requestActionPlan`, while pre-model latency covers observation building, live capture lookup/media preparation, and prompt assembly. In latest-frame mode, end-to-end response delay should no longer include the fixed completed-clip wait.

`ModelActionMemoryService` owns the short-term model action memory in the Electron main process. The canonical automation pipeline records each parsed plan after review/execution, and the dashboard model monitor records returned plans as `not_executed` because that development loop never runs actions directly. The next prompt includes this memory so providers can make context-aware choices, such as continuing a laugh reaction when the latest observation still supports it, without mechanically repeating prior actions.

Noop decisions are also represented in the compact `recentActions` history. This keeps the prompt easy to inspect while preserving the full prior plan JSON in `recentModelActions`.

## Current Execution Rules

- `vts.trigger_hotkey` now executes only when the model returns a current user-defined `catalogId` from `services.vts.automationCatalog.candidates` and the local validator confirms:
  - VTS readiness is `ready`
  - the catalog version is current
  - the selected candidate is still present
  - the candidate is classified as `safe_auto`
  - the action includes confidence of at least `0.88`
  - the action includes concrete visual evidence from the current media
  - the action does not include conflicting raw hotkey fields or extra fields outside the action schema
  - the evidence is compatible with deterministic cue rules for sensitive reactions such as love/heart and shock/surprise
  - the action is not cooling down or repeat-suppressed
- Live model-generated VTS actions should return cue labels rather than catalog IDs. Catalog IDs are added only by local deterministic cue-label resolution after parsing, and labels that are not mapped to a current safe-auto catalog entry are not sent to the model.
- Live latest-frame automation intentionally uses a high trigger threshold. Ambiguous, subtle, audio-only, or ordinary speaking cues should return `noop`; random or low-confidence emote guesses are blocked locally even if the model names a valid safe-auto catalog item.
- Empty model action arrays are normalized to an explicit `noop`, and model-suggested next tick delays below 500ms are clamped before use.
- Truncated or invalid action-plan tool output is converted to a safe fallback `noop` instead of failing the live tick. This includes `finish_reason: "length"`, invalid tool-call JSON, and schema validation failure after normalization.
- Provider-side normalization strips VTS-only fields from `noop`, fills app-owned metadata (`schemaVersion`, `tickId`, `createdAt`), removes model `debug`, and truncates long model reason/evidence strings before schema validation.
- VTS hotkey classification is cached by loaded model and hotkey hash. Background VTS refreshes should not regenerate classifications unless the loaded model changes, the hotkey list hash changes, or no cached classifications exist.
- Truncated or incomplete classifier output falls back to heuristic classifications. `finish_reason: "length"`, invalid JSON, schema validation failure, or an output item count mismatch all invalidate the classifier result.
- Love/heart reactions are demoted out of `safe_auto` by default. A broad smile, happy face, or braces-only evidence must not trigger a love reaction automatically.
- `noop` is now blocked when its reason clearly argues for one of the currently available safe-auto catalog actions. This is a guard against plans that detect a cue correctly but still self-suppress.
- When an executed VTS catalog entry is marked locally as not auto-deactivating, `ActionExecutorService` schedules a follow-up trigger of the same underlying hotkey after the configured delay to turn that state back off without asking the model to do it.
- Raw hotkey IDs are still available for manual operator testing, but live automation does not trust the model to choose them directly.
- `obs.set_scene` and `obs.set_source_visibility` are surfaced to the model and validated, but they currently stay in `confirmation_required` until a confirmation workflow is added.
- `vts.set_parameter` remains unsupported in execution.
- `overlay.message`, `log.event`, and `noop` are accepted as low-risk local actions.

## Operational Entry Point

A manual entry point is exposed over IPC at `automation:analyze-now` and through the renderer Manual Control panel.

- Dry run sends the model-control payload and returns reviewed action results without executing approved actions.
- Full run executes only actions that pass validation and do not require confirmation.
- Manual renderer automation requests now default to live capture input with OBS actions disabled so operators can exercise the same VTS-only path on demand.
