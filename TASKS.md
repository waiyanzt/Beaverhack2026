# Beaverhack2026 Task Breakdown

Four roles. Each owns a vertical slice of the system. Tasks are ordered by dependency — complete Step 1 together before proceeding.

---

## Role Assignments

| Role | Owner | Focus |
|---|---|---|
| A | Electron Core | Main process, IPC, settings, security, local API |
| B | Frontend UI | Renderer, React components, all screens and panels |
| C | Integrations | OBS, VTube Studio, capture, hidden capture window |
| D | AI Pipeline | Model providers, pipeline, automation, action plan |

---

## Step 1 — Project Skeleton (All roles, parallel after initial scaffold)

**Role A** creates the workspace and hands off entry points to the rest of the team.

- [ ] A-1.1 Init pnpm workspace with `pnpm-workspace.yaml` and root `package.json` per spec §19.1 and §19.2
- [ ] A-1.2 Scaffold `electron/` package with `package.json`, `tsconfig.json`, `vite.config.ts`, `electron-builder.yml` per spec §19.3
- [ ] A-1.3 Create `electron/src/main/index.ts` entry — app lifecycle, `app.ready`, window creation stubs
- [ ] A-1.4 Create `electron/src/preload/index.ts` with `contextBridge.exposeInMainWorld("beaverhack", ...)` per spec §15.1
- [ ] A-1.5 Create `electron/src/shared/` directory with placeholder files for types and schemas
- [ ] B-1.1 Create `electron/index.html`, `electron/src/renderer/main.tsx`, `electron/src/renderer/App.tsx` shell
- [ ] B-1.2 Add `electron/src/renderer/styles/globals.css` baseline styles
- [ ] B-1.3 Create `electron/src/renderer/types/electron-api.d.ts` typed surface matching the preload bridge

---

## Step 2 — Settings and Logs

**Role A** owns services. **Role B** owns UI.

- [ ] A-2.1 Define `AppConfig` and `DesktopConfig` types in `shared/types/config.types.ts` per spec §6.1
- [ ] A-2.2 Define `AppConfig` Zod schema in `shared/schemas/config.schema.ts` with default values per spec §6.2
- [ ] A-2.3 Implement `SettingsService` — load, save, validate config using `electron-store`
- [ ] A-2.4 Implement `SecretStoreService` — store/retrieve secrets via `safeStorage`, never return to renderer per spec §18.2
- [ ] A-2.5 Define `AppLogEvent` type in `shared/types/` per spec §17.1
- [ ] A-2.6 Implement `LoggerService` — in-memory ring buffer, emit `logs:event` to renderer, enforce do-not-log list per spec §17.2
- [ ] A-2.7 Implement `settings.ipc.ts` — `settings:get`, `settings:update` handlers with Zod validation per spec §15.2
- [ ] A-2.8 Implement IPC handler stubs in `logs` namespace — `logs:list`, `logs:clear`
- [ ] B-2.1 Implement `SettingsPanel.tsx` — form for all `AppConfig` sections
- [ ] B-2.2 Implement `LogViewer.tsx` — subscribe to `logs:event`, render scrollable list
- [ ] B-2.3 Implement `useAutomation.ts` hook stub (wired once automation exists)

---

## Step 3 — OBS Integration

**Role C** owns the service. **Role B** owns the status UI.

- [ ] C-3.1 Define `ObsStateSnapshot` and `SetSourceVisibilityInput` types in `shared/types/obs.types.ts` per spec §5.1 and §12.2
- [ ] C-3.2 Implement `OBSService` in `services/obs/obs.service.ts` — connect, disconnect, `getStateSnapshot`, `setCurrentScene`, `setSourceVisibility` using `obs-websocket-js` per spec §12
- [ ] C-3.3 Subscribe to OBS scene change and stream/recording state events; update internal snapshot
- [ ] C-3.4 Implement `obs.ipc.ts` — `obs:connect`, `obs:disconnect`, `obs:get-status` with Zod validation per spec §15.2
- [ ] C-3.5 Log OBS connection success/failure per spec §17.2
- [ ] B-3.1 Implement `StatusPanel.tsx` — display OBS connected/disconnected, current scene, stream status
- [ ] B-3.2 Implement `useOBS.ts` hook — `connect`, `disconnect`, `getStatus` wired to IPC
- [ ] B-3.3 Add OBS connect/disconnect controls to `StatusPanel`

---

## Step 4 — VTube Studio Integration

**Role C** owns the service. **Role B** owns the UI.

- [ ] C-4.1 Define `VtsStateSnapshot`, `VtsHotkey`, and `SetVtsParameterInput` types in `shared/types/vts.types.ts` per spec §5.1 and §13.2
- [ ] C-4.2 Implement `VTSService` in `services/vts/vts.service.ts` — connect, disconnect, authenticate, `getStateSnapshot`, `getHotkeys`, `triggerHotkey`, optional `setParameter` per spec §13
- [ ] C-4.3 Request plugin auth token from VTube Studio on first connect, store via `SecretStoreService`
- [ ] C-4.4 Implement `vts.ipc.ts` — `vts:connect`, `vts:disconnect`, `vts:authenticate`, `vts:get-hotkeys`, `vts:trigger-hotkey` per spec §15.2
- [ ] C-4.5 Log VTS connection and authentication success/failure per spec §17.2
- [ ] B-4.1 Add VTube Studio status section to `StatusPanel.tsx` — connected/authenticated, current model name
- [ ] B-4.2 Implement `useVTS.ts` hook — all VTS IPC operations
- [ ] B-4.3 Implement `ManualControlPanel.tsx` — list VTS hotkeys, trigger button per hotkey
- [ ] B-4.4 Implement `HotkeyMapper.tsx` — map hotkey IDs to labels for display

---

## Step 5 — Model Providers

**Role D** owns providers. **Role B** owns provider settings UI.

- [ ] D-5.1 Define `ModelProvider`, `ModelGenerateRequest`, `ModelGenerateResponse`, `ModelToolSchema`, `ModelToolCall` types in `shared/types/model.types.ts` per spec §7.1
- [ ] D-5.2 Define model config Zod schema in `shared/schemas/model.schema.ts` per spec §6.1
- [ ] D-5.3 Implement `OpenRouterProvider` in `services/model/openrouter.provider.ts` — send OpenAI-compatible request shape per spec §7.3, handle errors without logging API key
- [ ] D-5.4 Implement `OpenAICompatibleProvider` in `services/model/openai-compatible.provider.ts` — reuse same request shape for self-hosted endpoint
- [ ] D-5.5 Implement `MockProvider` in `services/model/mock.provider.ts` — return deterministic action plan for testing
- [ ] D-5.6 Implement `ModelRouter` in `services/model/model-router.service.ts` — select provider from config, run health check, fallback on failure, enter safe mode if both fail per spec §7.2
- [ ] D-5.7 Implement `model.ipc.ts` — `model:test-connection`, `model:set-provider`, `model:list-providers`
- [ ] B-5.1 Implement `ModelProviderPanel.tsx` — select provider, configure base URL and model name, test connection button
- [ ] B-5.2 Implement `useModelProvider.ts` hook
- [ ] B-5.3 Add API key input fields that write via `settings:update` (never read back in UI per security rules)

---

## Step 6 — Action Plan Pipeline

**Role D** owns the full pipeline. **Role A** wires IPC. **Role B** adds the trigger button.

- [ ] D-6.1 Define `ObservationEnvelope` and all sub-types in `shared/types/observation.types.ts` per spec §5.1
- [ ] D-6.2 Define `ActionPlan` and all `LocalAction` types in `shared/types/action-plan.types.ts` per spec §5.2
- [ ] D-6.3 Define Zod schemas for `ObservationEnvelope` and `ActionPlan` in `shared/schemas/`
- [ ] D-6.4 Implement `ObservationBuilder` in `services/automation/observation-builder.service.ts` — collect OBS state, VTS state, capture buffers, recent actions, runtime policy per spec §4.2
- [ ] D-6.5 Implement `PromptBuilder` in `services/automation/prompt-builder.service.ts` — build system prompt per spec §8.1, build `ObservationSummaryForModel` per spec §8.2, attach `createActionPlanTool` per spec §9
- [ ] D-6.6 Implement `ActionPlanParser` in `services/automation/action-plan-parser.service.ts` — extract action plan from tool call response, validate schema, return parse error on failure
- [ ] D-6.7 Implement `ActionValidator` in `services/automation/action-validator.service.ts` — enforce all 9 validation rules per spec §10.1 and autonomy level table per spec §10.2
- [ ] D-6.8 Implement `ActionExecutor` in `services/automation/action-executor.service.ts` — dispatch each approved action to OBSService, VTSService, or LoggerService; return `LocalActionResult[]` per spec §11
- [ ] D-6.9 Implement `PipelineService` in `services/automation/pipeline.service.ts` per spec §16
- [ ] A-6.1 Implement `automation.ipc.ts` — `automation:analyze-now` triggers one pipeline run, returns result summary
- [ ] B-6.1 Add "Analyze Now" button to `ManualControlPanel.tsx` or `StatusPanel.tsx`
- [ ] B-6.2 Display last pipeline result (action count, status, any blocked reason) in UI

---

## Step 7 — Automation Scheduler

**Role D** owns scheduling and cooldowns. **Role A** wires IPC. **Role B** adds start/stop controls.

- [ ] D-7.1 Implement `CooldownService` in `services/automation/cooldown.service.ts` — per-action-type cooldown tracking, check and record per spec §10.1 rule 6
- [ ] D-7.2 Implement `SchedulerService` in `services/automation/scheduler.service.ts` — configurable tick interval, emit timer triggers to pipeline, handle pause/resume per spec §10.2
- [ ] D-7.3 Wire recent action history into `ObservationBuilder` — last N `LocalActionResult` entries per spec §4.2 step 2
- [ ] D-7.4 Connect OBS and VTS events as pipeline triggers per spec §4.4
- [ ] A-7.1 Implement `automation:start` and `automation:stop` IPC handlers
- [ ] A-7.2 Implement `automation:get-status` — return current autonomy level, tick interval, running state
- [ ] B-7.1 Add automation start/stop toggle and autonomy level selector to `SettingsPanel.tsx` or a dedicated automation panel
- [ ] B-7.2 Display tick count and last tick timestamp in `StatusPanel.tsx`

---

## Step 8 — Capture

**Role C** owns all capture services. **Role B** owns capture UI. **Role A** wires IPC.

- [ ] C-8.1 Implement `hidden-capture-window.ts` — create off-screen `BrowserWindow` with media permissions enabled per spec §3.3
- [ ] C-8.2 Create hidden capture window renderer — request `getUserMedia` for camera and microphone, start `MediaRecorder` for audio, sample video frames to canvas as JPEG data URLs
- [ ] C-8.3 Implement `FrameBufferService` in `services/capture/frame-buffer.service.ts` — ring buffer of `CapturedFrame`, configurable max size per source
- [ ] C-8.4 Implement `AudioBufferService` in `services/capture/audio-buffer.service.ts` — ring buffer of `CapturedAudioChunk`, configurable buffer duration
- [ ] C-8.5 Implement `TranscriptionService` in `services/capture/transcription.service.ts` — send audio to provider `transcribeAudio` if enabled, return `TranscriptSegment[]`
- [ ] C-8.6 Implement `CaptureOrchestrator` in `services/capture/capture-orchestrator.service.ts` — coordinate camera, screen, audio capture; expose frame/audio/transcript buffers to `ObservationBuilder` per spec §14
- [ ] C-8.7 Implement desktop source listing for screen/window capture using Electron's `desktopCapturer`
- [ ] C-8.8 Log capture permission failure per spec §17.2
- [ ] A-8.1 Implement `capture.ipc.ts` — all `capture:*` handlers with source ID validation per spec §15.1
- [ ] B-8.1 Implement `CapturePanel.tsx` — camera toggle, screen source picker, audio toggle, live frame count display
- [ ] B-8.2 Implement `useCapture.ts` hook — all capture IPC operations

---

## Shared Types and Schema Ownership

These files are written incrementally as each step requires them. The owner of the step that first introduces a type writes it. Later steps extend but do not rewrite.

| File | First written by |
|---|---|
| `shared/types/config.types.ts` | Role A, Step 2 |
| `shared/types/obs.types.ts` | Role C, Step 3 |
| `shared/types/vts.types.ts` | Role C, Step 4 |
| `shared/types/model.types.ts` | Role D, Step 5 |
| `shared/types/observation.types.ts` | Role D, Step 6 |
| `shared/types/action-plan.types.ts` | Role D, Step 6 |
| `shared/schemas/config.schema.ts` | Role A, Step 2 |
| `shared/schemas/model.schema.ts` | Role D, Step 5 |
| `shared/schemas/observation.schema.ts` | Role D, Step 6 |
| `shared/schemas/action-plan.schema.ts` | Role D, Step 6 |
| `shared/constants.ts` | Role A, Step 1 |

---

## Minimum Demo Checklist (spec §22)

All roles contribute. Complete in order.

- [ ] App launches (A)
- [ ] User connects to OBS (C + B)
- [ ] User connects to VTube Studio (C + B)
- [ ] User authenticates VTube Studio plugin (C + B)
- [ ] App fetches VTS hotkeys (C + B)
- [ ] User configures model provider (D + B)
- [ ] User clicks Analyze Now (D + A + B)
- [ ] App sends OBS state, VTS state, and optional text to model (D)
- [ ] Model returns action plan (D)
- [ ] App validates action plan (D)
- [ ] App triggers a VTS hotkey (C + D)
- [ ] App logs the full pipeline result (A + D)
