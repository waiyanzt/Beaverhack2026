# AuTuber Debugging Log — Optimized Chronological Record

This document condenses the raw debugging log into a cleaner chronological record. It preserves the order of discovery while grouping related issues into phases, removing duplicate numbering confusion, and separating completed fixes from remaining follow-ups.

## Current State

- Electron app source and Vite output have been repeatedly verified after major changes.
- Unit tests have passed after the automation, VTS catalog, cue-label, AFK overlay, and provider-routing changes.
- `electron-vite build` has passed for the source bundle.
- Full packaged Electron builds have failed in sandbox/tooling-specific packaging stages, not in the TypeScript/Vite compile stages.
- `tsc --noEmit` still has pre-existing strictness issues in several service and test-mock areas.
- The live reaction loop is now cue-label driven: the model detects cues, and the Electron main process resolves those cues to local VTS or AFK actions.
- OBS AFK overlay execution still depends on a confirmed OBS WebSocket connection and a valid configured scene/source target.
- The latest UI issue is a misleading checkbox label/state mismatch around the AFK enable control.

## Chronological Phases

### Phase 1 — Repository And Electron Bootstrap

**Problem cluster:** The project structure did not match the intended app layout, and the Electron app could not boot reliably.

**Issues found**

- Electron app directory was named `electrons/` instead of `electron/`.
- Electron Vite config pointed at non-existent paths and used unsupported options for the installed `electron-vite` version.
- `tsconfig.json` was empty.
- The renderer expected a Next.js app that did not exist in the repo.
- Production `loadFile()` pointed at the wrong built renderer path.
- The shell leaked `ELECTRON_RUN_AS_NODE=1`, causing Electron to behave like Node.
- Linux/headless runs crashed when the GPU process was unavailable.
- Build output path did not match the repository spec.
- Root workspace files, docs, and placeholder directories were missing.
- IPC and window helpers were not organized under the expected `src/main/...` structure.
- The spec described more files than the repo currently had, and blindly scaffolding everything risked overwriting working files.

**Fixes applied**

- Renamed the app directory to `electron/`.
- Repointed Electron Vite to the real `src/...` tree and removed unsupported config properties.
- Added a strict TypeScript config with Electron/Vite typings.
- Added a minimal Vite renderer so Electron could boot independently.
- Corrected the production renderer path.
- Hardened the dev script by unsetting `ELECTRON_RUN_AS_NODE`.
- Temporarily disabled hardware acceleration for constrained environments, then later restored GPU acceleration after UI-lag work.
- Moved output to `dist/` and updated the package `main` entry.
- Added workspace skeleton files and placeholder directories.
- Moved IPC and window helpers into the expected main-process structure.
- Created only missing spec-defined files and kept existing working files untouched.

**Result**

The app reached a minimum bootable Electron/Vite state with a repo structure closer to the intended workspace layout.

---

### Phase 2 — Capture Pipeline MVP

**Problem cluster:** The capture work expanded the runtime surface faster than the original placeholder design.

**Issues found**

- Capture contracts were drifting across main, preload, renderer, and shared types.
- Screen capture triggered Chromium WGC failures on Windows.
- Audio input could appear enabled while the meter stayed flat.
- Browser-generated `.mp4` exports were invalid or unreliable.
- Export and refresh actions lacked operator feedback.

**Fixes applied**

- Added shared capture types and schemas for capture requests, clip payloads, export requests, and device/source metadata.
- Kept privileged capture/export behavior in the main process and exposed typed bridge methods only.
- Added capture UI controls for start, stop, refresh, and export.
- Forced Windows screen capture through selected desktop source handling instead of the WGC-first path.
- Restricted screen source selection to screen sources.
- Added explicit microphone selection and looser mic constraints.
- Resumed the hidden-window `AudioContext` before reading levels.
- Installed `ffmpeg-static` and moved exports into the main process.
- Switched to segmented recording so exported media chunks are self-contained.
- Added explicit ffmpeg stream mapping for video-only, audio-only, and combined exports.
- Added processing labels and disabled conflicting actions while work is in progress.

**Result**

The capture panel became usable as an operator/dev surface, with clearer capture status, export behavior, and failure visibility.

---

### Phase 3 — Merge Cleanup, Renderer Placement, And Checklist Drift

**Problem cluster:** Local capture work diverged from upstream app-shell work and project docs/checklists.

**Issues found**

- Local branch had drifted from `origin/main`.
- Capture UI was wired as the main renderer instead of a dev/reference surface.
- TypeScript config had duplicate JSX settings after merge.
- Tailwind plugin dependency was missing after merge.
- CSS import ordering caused Vite warnings.
- Linux camera/mic capture needed explicit app-window media permission handling.
- The first permission callback fix crashed because `details.webContents` was unavailable.
- Capture UI lagged from high-frequency polling, heavy paint effects, and preview blobs over IPC.
- Implementation checklist mixed real repo state with unverified spec goals.
- The debug log itself needed preserving instead of replacement.

**Fixes applied**

- Fetched upstream, stashed local work, merged current upstream, then replayed the capture work.
- Kept upstream tab shell as the main UI and mounted capture under the `Capture` tab.
- Removed duplicate TS compiler options and kept both TSX and test includes.
- Refreshed workspace install with `pnpm`.
- Moved Google Fonts `@import` above Tailwind import.
- Added a narrow main-process permission handler for trusted app media requests.
- Switched permission trust checks to the `webContents` argument with null/destroyed-state guards.
- Reduced capture status polling, restored GPU acceleration, and simplified expensive panel effects.
- Added `capture:status-lite` without preview blobs.
- Moved previews to direct `<video>` streams with track cleanup.
- Rewrote `docs/state/implementation-status.md` as a subsystem tracker.
- Appended new debug entries instead of replacing historical log content.

**Result**

The app shell, capture UI, permission path, and implementation checklist became more consistent with the current repo state.

---

### Phase 4 — Media Samples, Audio Transport, And Provider Probes

**Problem cluster:** Audio/video provider tests were hard to reproduce and initially used request shapes that did not work reliably.

**Issues found**

- Capture defaults started at very low FPS values.
- Standalone model-provider smoke test used hardcoded local media paths.
- There was no direct curl-based probe for sample MP4 analysis.
- First curl script hit shell argument limits by passing huge base64 payloads through argv.
- Raw model responses were difficult to read.
- Local MP4 clips were sent as base64 `data:` URLs, losing file semantics.
- vLLM audio-in-video processing defaulted to disabled.
- No regression test covered video URL normalization and audio flags.
- Audio script initially used an unsupported `audio_url` data-URI shape.
- Audio-only MP4 samples were not normalized before request.

**Fixes applied**

- Changed camera and screen default FPS to `30` in the capture panel.
- Resolved sample paths from the test file location with `import.meta.url` and `path.resolve(...)`.
- Added a standalone curl script for probing `/v1/chat/completions` with sample media.
- Wrote large JSON payloads to temporary files instead of argv.
- Pretty-printed valid JSON responses.
- Normalized local `video_url` inputs to absolute `file://` URLs.
- Set vLLM `useAudioInVideo` default to `true`.
- Added regression tests for local MP4 path normalization and `use_audio_in_video` forwarding.
- Added explicit `input_audio` support plus fallback audio modes.
- Converted non-WAV inputs to `16 kHz` mono WAV before sending.

**Result**

The model-provider media test path became reproducible, platform-tolerant, and easier to inspect.

---

### Phase 5 — VTube Studio Startup, Hotkeys, And Automation Pipeline

**Problem cluster:** VTS integration and model-controlled execution needed stronger runtime contracts.

**Issues found**

- `electron-store@11` ESM interop crashed with `Store is not a constructor`.
- VTS hotkey schema rejected valid API fields and empty hotkey names.
- Default VTS developer label was too generic.
- Implementation plan overstated progress in model, OBS, automation, and renderer-management areas.
- Automation pipeline services were still placeholders.
- The model needed a compact live service-capability snapshot.
- Model-proposed OBS/VTS actions needed validation gates.
- Upstream merge required a stash round-trip and conflict reconciliation.
- Model monitor expected a raw provider envelope while automation expected parsed action plans.

**Fixes applied**

- Normalized `electron-store` import with `module.default ?? module` and lazy store creation.
- Expanded VTS hotkey schema for `keyCombination`, `onScreenButtonID`, empty names, and passthrough fields.
- Updated default plugin developer label to `AuTuber Development Team`.
- Reconciled implementation-status docs with actual code state.
- Implemented observation builder, prompt builder, parser, validator, executor, cooldown tracker, and orchestration services.
- Wired manual `automation:analyze-now` IPC through the main process.
- Added typed model-control schemas for OBS state, VTS state, allowed actions, recent actions, and cooldowns.
- Validated VTS hotkeys and OBS scene/source actions against live state.
- Kept OBS scene/source changes on a confirmation-required path.
- Added `requestActionPlan()` for raw monitor envelopes while preserving `createActionPlan()` for pipeline use.
- Updated tests for both router paths.

**Result**

Model-generated actions now follow the canonical parse/validate/execute path, with VTS/OBS capability checks owned by the main process.

---

### Phase 6 — Live Evidence, Prompt Memory, And VTS Catalog Safety

**Problem cluster:** The live model could receive media but still ignore or misuse current evidence.

**Issues found**

- Electron Builder could not download binaries in the sandbox.
- Later model-system merges overlapped with local live-capture work.
- Live video was present but the model output did not change with the clip.
- Prompt memory was bloated with repeated noops and stale model actions.
- Camera clips and audio clips could be paired from different rolling windows.
- Repeated VTS hotkeys had no app-level suppression.
- Raw VTS hotkey IDs in model output were too trusting for live automation.
- VTS model changes could leak stale hotkeys into the catalog.
- Operators needed manual overrides for catalog classification.
- Packaged app confusion made source-level UI changes look missing.
- Toggle-style emotes needed manual deactivation support.
- Crying/sad expressions fell through to `unknown`.
- The model learned cooldown and blocked-history behavior instead of just detecting current cues.
- Live VTS prompts included too much OBS detail.
- Some `noop` reasons actually argued for an action.
- The prompt over-emphasized that noop was common.
- Returned pipeline context did not refresh compact summaries after execution.

**Fixes applied**

- Treated packaging failures as environment/tooling limits after verifying source build stages.
- Re-merged upstream and reconciled model-memory/live-capture overlap.
- Simplified live multimodal prompt to one video part plus one consolidated text part.
- Trimmed live prompt history and removed noop-only memory from the live path.
- Selected audio clips by best overlap against the current camera clip.
- Added default repeat suppression for VTS hotkeys.
- Introduced a versioned local VTS automation catalog.
- Changed model output from raw hotkey IDs to catalog selection, then later to cue labels.
- Rebuilt catalog from the current raw hotkey list only.
- Added a `VTS Catalog` management tab with generated classifications, effective classifications, and manual overrides.
- Added per-hotkey deactivation policy with optional scheduled follow-up triggers.
- Added sad/crying heuristics and classifier prompt guidance.
- Replaced full prior model-action reasoning with compact recent-action and cooldown summaries.
- Removed detailed OBS scene/source inventory from VTS-only live prompts.
- Added suspicious-noop validator logic for currently available safe-auto VTS candidates.
- Reworded prompt rules so clear single-candidate evidence prefers the matched action.
- Rebuilt compact context summaries after execution.

**Result**

Live reaction behavior became safer, less stale, more operator-configurable, and less dependent on model-controlled implementation identifiers.

---

### Phase 7 — Runtime Persistence, Service Activation, And Latency Visibility

**Problem cluster:** Runtime state and live monitor behavior were not persistent or visible enough for real operation.

**Issues found**

- Camera, mic, screen source, selected provider, and monitor session state were not persisted.
- Status panel showed placeholders instead of live service state.
- Live monitor stopped at response display and did not execute actions.
- OBS had startup activation, but VTS did not.
- VTS reconnects requested new tokens too often.
- Empty VTS hotkey names broke observation validation.
- Recent action logs used machine-oriented target keys only.
- Live reaction latency was around `3.5s` to `4s`.
- Raw model inputs/outputs were not visible enough for debugging after latency work.

**Fixes applied**

- Added persisted app config through `electron-store`.
- Exposed typed `settings:get` and `settings:update` IPC.
- Persisted dashboard selections, provider selection, and monitor session state.
- Updated status panel to read live monitor/capture state.
- Restored monitor on launch only if previous session was intentionally left running.
- Routed live monitor through `PipelineService` instead of direct model-router calls.
- Built live-capture prompt input from latest buffered camera/audio evidence.
- Kept live monitor VTS-only by disabling OBS actions in policy.
- Added `ServiceActivationService` for OBS/VTS startup activation, retry, status, and manual retry.
- Reused cached in-session VTS auth tokens before requesting new ones.
- Normalized blank hotkey names to `Unnamed Hotkey (<hotkeyID>)`.
- Added human-readable recent-action labels.
- Added timing instrumentation for observation, capture prep, prompt, provider, execution, and total latency.
- Used latest buffered webcam frame by default for low-latency reactions.
- Re-enabled redacted model request/response logs.

**Result**

The live monitor became persistent, actionable, and easier to profile, while avoiding direct bypasses around the core pipeline.

---

### Phase 8 — Accuracy Hardening And Cue-Label Split

**Problem cluster:** Faster reactions exposed accuracy problems and schema fragility.

**Issues found**

- Faster frame-based reactions triggered weak or random emotes.
- Heart/love reactions fired from smiles or braces.
- Shock/surprise fired from neutral or smiling expressions.
- VTS hotkey classifier ran too often and sometimes returned truncated JSON.
- Action-plan tool calls were sometimes truncated with `finish_reason: "length"`.
- Some responses had empty actions or noisy noop actions with VTS-only fields.
- The model saw too much VTS implementation detail.
- Cue labels were hardcoded, rigid, and could include labels with no executable mapping.
- Prompts/docs still described older catalog-ID selection behavior.

**Fixes applied**

- Added confidence thresholds and required concrete visual evidence.
- Added deterministic gates for love/heart and shock/surprise reactions.
- Demoted heart/love-style catalog classifications out of `safe_auto` by default.
- Normalized empty model action arrays into explicit noop decisions.
- Cached VTS classifications by model and hotkey-list hash.
- Rejected truncated, unparsable, invalid, or wrong-count classifier responses.
- Fell back to local heuristics when classifier output was not trustworthy.
- Increased action-plan token budget from `384` to `768`.
- Converted truncated tool output into safe fallback noop instead of throwing.
- Normalized plans before Zod validation: explicit noop, stripped noop fields, truncated text, app-owned metadata filled locally, model debug removed.
- Split live VTS decision-making into two steps:
  1. Model detects cue labels from current media.
  2. Electron main process maps cue labels to exactly one current safe-auto catalog entry.
- Removed VTS hotkey names, raw IDs, catalog IDs, and catalog candidates from live model prompts.
- Moved cue labels into persisted operator-managed settings.
- Added typed schemas, IPC, preload, hooks, and VTS Catalog UI for cue-label management.
- Sent only active safe-auto cue labels to the live prompt and provider tool schema.
- Updated prompts and docs to describe cue-label-only live automation.

**Result**

The model now performs a narrower perception task, while local deterministic code handles action resolution and safety.

---

### Phase 9 — Secondary Transcript And LM Studio Provider Limits

**Problem cluster:** Secondary analysis could preview media but could not reliably extract transcript/audio from the provider path.

**Issues found**

- Secondary model preview showed the video but returned `model returned no transcript`.
- Audio was muxed into MP4 only, with no separate audio attachment.
- LM Studio endpoint was reachable and listed `nvidia/nemotron-3-nano-omni`, but rejected `video_url`, `input_audio`, and non-image `image_url` chat payloads.
- It was unclear whether failures came from corrupt samples or provider request shape.
- `127.0.0.1:1234` was not reachable from the workspace.

**Fixes applied**

- Attached matching audio segment separately for secondary live analysis.
- Updated prompt metadata so audio packaging is explicit.
- Verified LM Studio route behavior directly and concluded this route cannot depend on raw video/audio multimodal fields unless provider support exists.
- Checked samples with `ffprobe`:
  - camera MP4 contains H.264 video plus mono AAC audio.
  - WAV sample is mono 16 kHz PCM.
  - audio-only MP4 is mono AAC.
- Switched verification to `http://192.168.240.1:1234` after host address discovery.

**Result**

The issue was narrowed to provider media-shape support, not sample corruption. Practical direction is to keep visual input as frames/images and route transcript/audio through STT or another audio-capable provider path.

---

### Phase 10 — OBS AFK Overlay And Vacancy Handling

**Problem cluster:** The app needed deterministic OBS overlay behavior for AFK/vacant frames without letting the model directly control OBS.

**Issues found**

- A merge reintroduced older OBS BRB behavior.
- The BRB path used a hardcoded `BRB Overlay` source name.
- The live model could produce `vacant`, but no local handler owned the OBS overlay transition.
- Legacy `vacancyOverlay` settings needed migration.
- Packaging failed again in the sandbox during node-module collection.
- The `vacant` cue was incorrectly treated like a VTS safe-auto reaction.
- AFK prompt contradicted itself by saying empty frames should both use `vacant` and sometimes noop.
- `log.event` actions stored `reason` incorrectly, poisoning the next observation.
- OBS connectivity to `ws://localhost:4455` was not confirmed.
- The latest UI confusion came from a disabled checkbox whose label said `enable`.

**Fixes applied**

- Checked reflog/history to confirm local commits still existed.
- Replaced hardcoded BRB overlay handling with a configurable AFK overlay service.
- Added `afkOverlay` settings with explicit scene/source selection.
- Wired dashboard scene/source inventory selection for the overlay target.
- Added `AfkOverlayService` to own AFK transition state and debounce timer.
- Kept live model-generated OBS actions disabled while allowing local AFK overlay validation.
- Routed model `vacant` cue to the local OBS overlay service.
- Migrated legacy `vacancyOverlay` config into `afkOverlay` with automation disabled by default.
- Treated sandbox packaging failure as tooling/environment limitation after source verification.
- Skipped VTS cue-label resolution and validator review for `vacant` so AFK can handle it locally.
- Reworded live prompt: empty, covered, black, or pointed-away frames with no visible person must emit `cueLabels: ["vacant"]`.
- Normalized log-event execution result reasons and sanitized malformed recent model actions.
- Added local AFK diagnostics so the monitor reports disabled automation, disconnected OBS, or missing scene/source targets.
- Recorded the checkbox label/state mismatch for UI review.

**Result**

AFK/vacant handling is now a local deterministic OBS workflow, but runtime success still requires OBS connectivity and a valid configured overlay scene/source.

---

## Verification History

Use this section as a compact audit trail rather than repeating verification after every entry.

- `pnpm --filter @beaverhack/electron build` passed during earlier Electron setup work.
- `pnpm --filter @beaverhack/electron test` passed during earlier Electron setup work.
- `pnpm --filter @beaverhack/electron lint` originally used a placeholder ESLint script.
- `npm test` passed in `electron/` after persisted runtime-state work.
- `npx electron-vite build` passed in `electron/` after persisted runtime-state work.
- `pnpm --filter @autuber/electron test` passed after router/merge reconciliation.
- `pnpm --filter @autuber/electron test` later passed with `19` test files and `63` tests after cue-label and prompt/schema changes.
- `pnpm --filter @autuber/electron exec electron-vite build` passed after cue-label and prompt/schema changes.
- `pnpm --filter @autuber/electron lint` passed, though the lint command still depends on the existing placeholder setup.
- `pnpm --filter @autuber/electron exec tsc --noEmit` still fails on pre-existing strictness issues in action-executor, OBS, media-conversion, and test mocks.
- Full `electron-builder` packaging failed in sandbox/tooling-specific stages at least twice:
  - once while downloading Electron from GitHub.
  - once while collecting node modules with `No JSON content found in output`.

## Remaining Follow-Ups

### P0 — Demo-Critical

- Fix the AFK enable checkbox label/state mismatch so the UI clearly shows whether AFK overlay automation is enabled.
- Confirm OBS WebSocket host, port, password, and connection status in the running environment.
- Confirm the configured AFK overlay scene/source exists in OBS and can be toggled manually.
- Keep OBS actions disabled in model policy for live ticks; only allow the local AFK overlay handler to toggle the configured source.
- Decide whether the demo uses frame/image-only visual analysis plus STT, since LM Studio did not accept raw video/audio chat-completions media shapes.

### P1 — Stability And Accuracy

- Add a provider capability matrix in settings/docs: image frames, raw audio, video URL, file URL, tool calling, JSON mode, and STT support.
- Add clear UI warnings when the selected model provider does not support the media shape required by a feature.
- Add a runtime debug panel section that separates pre-model latency, provider latency, validation latency, execution latency, and total tick latency.
- Add a visible recent-action timeline that shows cue label, local resolver result, validation result, and executed service action.
- Confirm VTS catalog regeneration after model changes drops stale hotkeys every time.

### P2 — Cleanup

- Renumber the raw `docs/debugging-log.md` entries if keeping the full uncompressed historical log.
- Move duplicate “debug log updated in place” entries into a single maintenance note.
- Separate sandbox/tooling failures from source-code regressions in the docs.
- Resolve remaining strict TypeScript issues so `tsc --noEmit` can become part of the normal verification gate.
- Replace placeholder lint script with real ESLint config if it has not already been done in the latest branch.

## Suggested Next Debugging Entry Template

Use this format for new entries going forward:

```markdown
## <next-number>. <Short Problem Title>

Problem:
- <Concrete symptom.>
- <Why it mattered.>

Root Cause:
- <Specific technical cause, if known.>

Fix:
- <What changed.>
- <Where it changed, if useful.>

Verification:
- `<command>` passed.
- <Runtime behavior confirmed, if applicable.>

Follow-up:
- <Only include if something remains open.>
```

## Notes On Optimization

- The original chronology was preserved at the phase level.
- Duplicate numeric headings were not carried forward as authoritative numbers.
- Related fixes were grouped together so the log reads as a debugging narrative instead of a long patch ledger.
- Repeated “updated the log in place” items were folded into the relevant maintenance phase.
- Verification was moved into a single audit section to reduce repetition.
- Environment/tooling failures were separated from app source-code failures.
