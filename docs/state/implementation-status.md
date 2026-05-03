# Beaverhack2026 Implementation Checklist

## Status Legend

- `[x]` done
- `[~]` in progress
- `[ ]` not started

A feature is only complete when it has the needed service logic, typed IPC/API boundary, UI/status path, logs, tests where applicable, and docs.

Current snapshot:

- VTube Studio connection, authentication, hotkey loading, and capture ingestion are the most complete areas.
- OBS controls, settings/logs IPC, model-provider management UI, and the end-to-end automation pipeline are still incomplete.
- The model pipeline files exist in the tree, but most of them are still placeholders or partial scaffolding.

---

## 0. Minimum Demo Checklist

- [x] App launches
- [ ] User can connect to OBS
- [x] User can connect to VTube Studio
- [x] User can authenticate VTube Studio plugin
- [x] App fetches VTS hotkeys
- [ ] User can configure model provider
- [ ] User can test model provider connection
- [ ] User can click Analyze Now
- [ ] App builds observation using OBS state and VTS state
- [ ] App sends prompt to model provider
- [ ] Model returns structured ActionPlan
- [ ] App parses ActionPlan
- [ ] App validates ActionPlan
- [ ] App blocks unsafe actions
- [x] App triggers allowed VTS hotkey
- [ ] App logs full pipeline result
- [ ] User can review action results in LogViewer

---

## 1. Project Setup / Foundation

### Workspace

- [x] Create root `package.json`
- [x] Create `pnpm-workspace.yaml`
- [x] Create `turbo.json`
- [x] Create root `.gitignore`
- [x] Create root `.env.example`
- [x] Create root `README.md`
- [x] Create `electron/` app directory
- [x] Create `apps/.gitkeep`
- [x] Create `packages/.gitkeep`
- [x] Create `models/prompts/`
- [x] Create `scripts/`

### Electron Package

- [x] Create `electron/package.json`
- [x] Create `electron/tsconfig.json`
- [x] Create `electron/vite.config.ts`
- [x] Create `electron/electron-builder.yml`
- [x] Create `electron/index.html`
- [x] Add Electron dependency
- [x] Add Vite dependency
- [x] Add React dependency
- [x] Add TypeScript dependency
- [x] Add Vitest dependency
- [x] Add Zod dependency
- [x] Add `obs-websocket-js`
- [x] Add `ws`
- [x] Add `electron-store`

### App Boot

- [x] Create `electron/src/main/index.ts`
- [x] Create secure main BrowserWindow
- [x] Ensure `nodeIntegration: false`
- [x] Ensure `contextIsolation: true`
- [x] Ensure `sandbox: true`
- [x] Create `electron/src/preload/index.ts`
- [x] Create `electron/src/renderer/main.tsx`
- [x] Create `electron/src/renderer/App.tsx`
- [~] Confirm `pnpm dev` opens app window

---

## 2. Shared Types And Schemas

### Shared Types

- [x] Create `electron/src/shared/types/action-plan.types.ts`
- [x] Create `electron/src/shared/types/config.types.ts`
- [x] Create `electron/src/shared/types/model.types.ts`
- [x] Create `electron/src/shared/types/obs.types.ts`
- [x] Create `electron/src/shared/types/observation.types.ts`
- [x] Create `electron/src/shared/types/vts.types.ts`
- [x] Create shared IPC result type
- [x] Create shared app log type
- [x] Create action type constants/unions

### Zod Schemas

- [x] Create `electron/src/shared/schemas/action-plan.schema.ts`
- [x] Create `electron/src/shared/schemas/config.schema.ts`
- [x] Create `electron/src/shared/schemas/model.schema.ts`
- [x] Create `electron/src/shared/schemas/observation.schema.ts`
- [x] Validate ActionPlan schema
- [x] Validate AppConfig schema
- [x] Validate model provider config schema
- [x] Validate ObservationEnvelope schema
- [x] Add schema tests

---

## 3. Settings, Secrets, And Logs

### Settings Service

- [x] Create `electron/src/main/services/settings/settings.service.ts`
- [x] Define default config
- [x] Load config from local store
- [x] Save config to local store
- [x] Validate config on load
- [x] Validate config on update
- [x] Recover safely from invalid config
- [x] Never expose secrets through settings response
- [x] Add settings service tests

### Secret Store

- [x] Create `electron/src/main/services/settings/secret-store.service.ts`
- [x] Store OpenRouter API key securely
- [x] Store self-hosted API key securely if configured
- [x] Store OBS WebSocket password securely
- [x] Store VTube Studio auth token securely
- [x] Redact secrets from errors
- [x] Add secret redaction tests

### Logger Service

- [x] Create `electron/src/main/services/logger/logger.service.ts`
- [x] Add structured log event type
- [x] Log app startup
- [x] Log settings load failure
- [x] Log OBS connection success/failure
- [x] Log VTS connection success/failure
- [x] Log VTS authentication success/failure
- [x] Log model provider connection test
- [x] Log automation start/stop
- [x] Log pipeline tick start/end
- [x] Log model request failure
- [x] Log action plan parse failure
- [x] Log blocked actions
- [x] Log executed actions
- [x] Log capture permission failure
- [x] Ensure logs never include API keys
- [x] Ensure logs never include OBS password
- [x] Ensure logs never include VTS token
- [x] Ensure logs never include raw screen frames
- [x] Ensure logs never include raw microphone audio

---

## 4. Preload And IPC

### Preload API

- [x] Expose `window.beaverhack.automation`
- [x] Expose `window.beaverhack.capture`
- [x] Expose `window.beaverhack.model`
- [x] Expose `window.beaverhack.obs`
- [x] Expose `window.beaverhack.vts`
- [x] Expose `window.beaverhack.settings`
- [x] Expose `window.beaverhack.logs`
- [x] Add renderer type declaration for preload API
- [x] Ensure renderer never imports main-process services

### IPC Infrastructure

- [x] Create typed IPC helper
- [x] Validate all IPC inputs with Zod
- [x] Reject unknown IPC fields
- [x] Return typed success/error results
- [x] Never throw raw errors to renderer
- [x] Log meaningful IPC failures
- [x] Add IPC validation tests

### IPC Channels

- [ ] Implement `settings:get`
- [ ] Implement `settings:update`
- [ ] Implement `logs:list`
- [ ] Implement `logs:clear`
- [ ] Implement `logs:event`
- [ ] Implement `obs:connect`
- [ ] Implement `obs:disconnect`
- [ ] Implement `obs:get-status`
- [x] Implement `vts:connect`
- [x] Implement `vts:disconnect`
- [x] Implement `vts:authenticate`
- [x] Implement `vts:get-hotkeys`
- [x] Implement `vts:trigger-hotkey`
- [x] Implement `model:test-connection`
- [x] Implement `model:set-provider`
- [x] Implement `model:list-providers`
- [ ] Implement `automation:start`
- [ ] Implement `automation:stop`
- [ ] Implement `automation:analyze-now`
- [ ] Implement `automation:get-status`
- [x] Implement `capture:get-sources`
- [x] Implement `capture:start-camera`
- [x] Implement `capture:stop-camera`
- [x] Implement `capture:start-screen`
- [x] Implement `capture:stop-screen`
- [x] Implement `capture:start-audio`
- [x] Implement `capture:stop-audio`

---

## 5. Renderer UI

### App Shell

- [x] Create main renderer layout
- [x] Create setup/status navigation
- [ ] Add app loading state
- [ ] Add first-run setup state
- [ ] Add global error display
- [x] Add light/dark compatible base styling

### Panels

- [x] Create `StatusPanel.tsx`
- [x] Create `SettingsPanel.tsx`
- [x] Create `ModelProviderPanel.tsx`
- [x] Create `CapturePanel.tsx`
- [x] Create `ManualControlPanel.tsx`
- [x] Create `HotkeyMapper.tsx`
- [x] Create `LogViewer.tsx`
- [ ] Add loading skeleton for status panel
- [ ] Add loading skeleton for settings panel
- [ ] Add loading skeleton for model provider panel
- [ ] Add loading skeleton for capture panel
- [ ] Add loading skeleton for logs viewer
- [ ] Add empty states
- [ ] Add actionable error states

### Hooks

- [x] Create `useAutomation.ts`
- [x] Create `useCapture.ts`
- [x] Create `useModelProvider.ts`
- [x] Create `useOBS.ts`
- [x] Create `useVTS.ts`
- [x] Ensure hooks only use preload API
- [~] Ensure hooks handle loading/error/success states

---

## 6. OBS Integration

### OBS Service

- [x] Create `electron/src/main/services/obs/obs.service.ts`
- [x] Connect to OBS WebSocket
- [x] Disconnect from OBS WebSocket
- [x] Read current scene
- [x] Read current scene sources
- [x] Read stream status
- [x] Read recording status
- [x] Subscribe to scene change events
- [x] Subscribe to stream/recording state events
- [x] Return typed `ObsStateSnapshot`
- [x] Handle OBS connection errors cleanly
- [x] Add OBS service tests with mocks

### OBS Actions

- [ ] Implement `setCurrentScene`
- [ ] Implement `setSourceVisibility`
- [ ] Require confirmation for scene changes by default
- [ ] Require confirmation for source visibility changes by default
- [ ] Log all OBS actions
- [ ] Log all blocked OBS actions

### OBS UI

- [ ] Add OBS connect button
- [ ] Add OBS disconnect button
- [ ] Show OBS connection status
- [ ] Show current scene
- [ ] Show stream status
- [ ] Show recording status
- [ ] Show OBS errors in user-friendly language

---

## 7. VTube Studio Integration

### VTS Service

- [x] Create `electron/src/main/services/vts/vts.service.ts`
- [x] Connect to VTube Studio WebSocket
- [x] Disconnect from VTube Studio
- [x] Request VTS authentication token
- [x] Authenticate with stored token
- [x] Fetch current model info
- [x] Fetch available hotkeys
- [x] Return typed `VtsStateSnapshot`
- [x] Handle VTS connection errors cleanly
- [x] Add VTS service tests with mocks

### VTS Actions

- [x] Implement `triggerHotkey`
- [ ] Implement optional `setParameter`
- [x] Keep `vts.trigger_hotkey` allowed in `auto_safe`
- [ ] Require confirmation for `vts.set_parameter`
- [ ] Log all VTS actions
- [ ] Log all blocked VTS actions

### VTS UI

- [x] Add VTS connect button
- [x] Add VTS disconnect button
- [x] Add VTS authenticate button
- [x] Show VTS connection status
- [x] Show authentication status
- [x] Show current model name
- [x] Show hotkey list
- [x] Add manual hotkey trigger/test button
- [x] Show VTS errors in user-friendly language

---

## 8. Model Providers

### Provider Interface

- [x] Create `electron/src/main/services/model/model-provider.types.ts`
- [x] Define `ModelGenerateRequest`
- [x] Define `ModelGenerateResponse`
- [x] Define `ModelToolSchema`
- [x] Define `ModelToolCall`
- [x] Define `ModelProvider`
- [x] Add provider health check interface

### Providers

- [x] Create `mock.provider.ts`
- [x] Create `openrouter.provider.ts`
- [x] Create `openai-compatible.provider.ts`
- [x] Create `self-hosted.provider.ts`
- [x] Implement OpenRouter request shape
- [x] Implement self-hosted OpenAI-compatible request shape
- [x] Implement provider timeout handling
- [x] Implement provider error redaction
- [x] Add provider tests with mocked network calls

### Model Router

- [x] Create `model-router.service.ts`
- [x] Load selected provider config
- [x] Run selected provider health check
- [x] Call selected provider for pipeline tick
- [ ] Fallback to configured fallback provider
- [ ] Return pipeline failure if all providers fail
- [ ] Enter safe mode if model provider fails critically
- [ ] Log provider errors without exposing API keys
- [ ] Add ModelRouter fallback tests

### Model UI

- [ ] Add provider selector
- [ ] Add model name field
- [ ] Add base URL field
- [ ] Add API key field with secret-safe behavior
- [ ] Add provider capability display
- [ ] Add test connection button
- [ ] Show provider test result
- [ ] Show provider failure logs

---

## 9. Prompt And Action Plan Pipeline

### Prompt Builder

- [ ] Create `prompt-builder.service.ts`
- [ ] Add system prompt template
- [ ] Build observation summary for model
- [ ] Build tool schemas based on policy
- [ ] Ensure prompt excludes secrets
- [ ] Add PromptBuilder tests

### Action Plan Tool

- [ ] Create `create_action_plan` tool schema
- [ ] Enforce required `actions`
- [ ] Enforce required `safety`
- [ ] Enforce required `nextTick`
- [ ] Add tests for valid tool schema

### Action Plan Parser

- [ ] Create `action-plan-parser.service.ts`
- [ ] Parse tool call response
- [ ] Parse JSON response fallback if needed
- [ ] Attach observation `tickId`
- [ ] Validate parsed plan with Zod
- [ ] Return safe parse errors
- [ ] Log parse failures
- [ ] Add parser tests

### Action Validator

- [ ] Create `action-validator.service.ts`
- [ ] Validate schema
- [ ] Enforce `maxActionsPerTick`
- [ ] Enforce allowed action list
- [ ] Enforce blocked action list
- [ ] Enforce action-specific validation
- [ ] Enforce cooldowns
- [ ] Enforce autonomy level
- [ ] Require confirmation for high-risk actions
- [ ] Return blocked action results
- [ ] Log blocked action reasons
- [ ] Add validator tests

### Cooldown Service

- [ ] Create `cooldown.service.ts`
- [ ] Track global action cooldown
- [ ] Track per-action cooldown
- [ ] Track repeated VTS hotkey cooldown
- [ ] Add cooldown tests

### Action Executor

- [ ] Create `action-executor.service.ts`
- [ ] Execute `vts.trigger_hotkey`
- [ ] Execute `vts.set_parameter`
- [ ] Execute `obs.set_scene`
- [ ] Execute `obs.set_source_visibility`
- [ ] Execute `overlay.message`
- [ ] Execute `log.event`
- [ ] Execute `noop`
- [ ] Return `LocalActionResult` for every action
- [ ] Handle partial action failure
- [ ] Log executed actions
- [ ] Add executor tests with mocked OBS/VTS

### Pipeline Service

- [ ] Create `pipeline.service.ts`
- [ ] Build observation
- [ ] Build prompt
- [ ] Call model router
- [ ] Parse action plan
- [ ] Validate action plan
- [ ] Execute approved actions
- [ ] Return completed result
- [ ] Return blocked result
- [ ] Return failed result
- [ ] Log pipeline tick start/end
- [ ] Add pipeline tests with mock provider

---

## 10. Observation Builder

### Observation Envelope

- [ ] Create `observation-builder.service.ts`
- [ ] Generate session ID
- [ ] Generate tick ID
- [ ] Add created timestamp
- [ ] Add source metadata
- [ ] Add OBS snapshot
- [ ] Add VTS snapshot
- [ ] Add runtime snapshot
- [ ] Add runtime policy
- [ ] Add recent action history
- [ ] Add optional user text
- [ ] Add optional camera frames
- [ ] Add optional screen/window frames
- [ ] Add optional audio chunks
- [ ] Add optional transcript segments
- [ ] Validate final ObservationEnvelope
- [ ] Add observation builder tests

### Runtime Policy

- [ ] Implement `paused`
- [ ] Implement `suggest_only`
- [ ] Implement `auto_safe`
- [ ] Implement `auto_full`
- [ ] Implement `safe_mode`
- [ ] Default allowed actions to VTS hotkey, overlay message, log event, noop
- [ ] Default blocked actions to OBS scene, OBS source visibility, VTS parameter
- [ ] Add runtime policy tests

---

## 11. Automation

### Scheduler

- [ ] Create `scheduler.service.ts`
- [ ] Start automation loop
- [ ] Stop automation loop
- [ ] Respect `tickIntervalMs`
- [ ] Prevent overlapping ticks
- [ ] Trigger pipeline on timer
- [ ] Trigger pipeline on manual Analyze Now
- [ ] Support OBS event trigger
- [ ] Support VTS event trigger
- [ ] Support capture event trigger
- [ ] Add scheduler tests

### Automation UI

- [ ] Add start automation button
- [ ] Add stop automation button
- [ ] Add Analyze Now button
- [ ] Add autonomy level selector
- [ ] Show automation enabled/disabled status
- [ ] Show last tick status
- [ ] Show recent action history
- [ ] Show blocked action visibility
- [ ] Show cooldown state
- [ ] Show safe mode state

---

## 12. Capture

### Hidden Capture Window

- [x] Create `hidden-capture-window.ts`
- [x] Request microphone permission
- [x] Request camera permission
- [x] Request screen/window capture permission
- [x] Run `navigator.mediaDevices.getUserMedia`
- [x] Run `MediaRecorder`
- [x] Sample video frames into canvas
- [x] Encode frames as JPEG/PNG data URLs
- [x] Send frames/audio chunks to main process
- [x] Handle permission denial cleanly
- [x] Log capture permission failures

### Capture Services

- [x] Create `capture-orchestrator.service.ts`
- [x] Create `frame-buffer.service.ts`
- [x] Create `audio-buffer.service.ts`
- [x] Create `transcription.service.ts`
- [x] List available desktop capture sources
- [x] Start camera capture
- [x] Stop camera capture
- [x] Start screen/window capture
- [x] Stop screen/window capture
- [x] Start microphone capture
- [x] Stop microphone capture
- [x] Maintain recent camera frame buffer
- [x] Maintain recent screen/window frame buffer
- [x] Maintain audio buffer
- [x] Maintain transcript buffer
- [x] Respect max frame limits
- [x] Respect configured FPS
- [x] Respect raw audio sending disabled by default
- [x] Prefer transcript over raw audio by default
- [x] Add capture service tests where practical

### Capture UI

- [x] Add camera capture toggle
- [x] Add screen/window capture toggle
- [x] Add microphone capture toggle
- [x] Add source selector
- [x] Add capture status display
- [x] Add privacy warning/description
- [x] Show what is currently being captured
- [x] Show permission errors
- [x] Keep screen capture disabled by default
- [x] Keep raw audio sending disabled by default

---

## 13. Local API

### Local API Foundation

- [ ] Create `electron/src/main/local-api/server.ts`
- [ ] Create `electron/src/main/local-api/routes.ts`
- [ ] Create `electron/src/main/local-api/auth.ts`
- [ ] Keep local API disabled by default
- [ ] Bind only to `100.93.134.64`
- [ ] Require bearer token
- [ ] Validate all request bodies
- [ ] Never expose secrets
- [ ] Never allow unauthenticated action execution
- [ ] Add local API docs if enabled
- [ ] Add local API tests if enabled

---

## 14. Documentation

### Required Docs

- [x] Create `docs/standards/engineering.md`
- [x] Create `docs/standards/security.md`
- [x] Create `docs/standards/ipc.md`
- [x] Create `docs/standards/model-providers.md`
- [x] Create `docs/standards/action-plans.md`
- [x] Create `docs/standards/ui.md`
- [x] Create `docs/apps/electron.md`
- [x] Create `docs/features/automation-pipeline.md`
- [x] Create `docs/features/obs-integration.md`
- [x] Create `docs/features/vts-integration.md`
- [x] Create `docs/features/capture.md`
- [x] Create `docs/references/commands.md`
- [x] Create `docs/references/repository-structure.md`
- [x] Create `docs/state/implementation-status.md`

### Docs Updates

- [x] Document setup commands
- [x] Document dev commands
- [x] Document build commands
- [x] Document test commands
- [x] Document OBS setup
- [x] Document VTube Studio setup
- [x] Document model provider setup
- [x] Document capture privacy behavior
- [x] Document action validation behavior
- [x] Document safe defaults
- [x] Document known limitations
- [x] Document current implementation status

---

## 15. Tests

### Unit Tests

- [ ] Add Zod schema tests
- [ ] Add ActionPlanParser tests
- [ ] Add ActionValidator tests
- [ ] Add CooldownService tests
- [ ] Add ModelRouter fallback tests
- [ ] Add PromptBuilder tests
- [ ] Add SettingsService tests
- [ ] Add secret redaction tests
- [ ] Add IPC validation tests
- [ ] Add PipelineService tests with mock provider

### Integration Tests

- [ ] Add mocked OBS integration tests
- [ ] Add mocked VTS integration tests
- [ ] Add model-provider mock integration tests
- [ ] Add renderer/preload boundary tests if practical

### E2E / Demo Tests

- [x] App launches
- [ ] Settings load
- [ ] Logs render
- [ ] OBS connect flow works
- [ ] VTS connect flow works
- [ ] VTS authentication flow works
- [ ] Hotkeys load
- [ ] Manual hotkey trigger works
- [ ] Model provider test works
- [ ] Analyze Now works with mock provider
- [ ] Analyze Now works with real configured provider
- [ ] Unsafe actions are blocked or require confirmation
- [ ] Pipeline result appears in logs

---

## 16. Nice-To-Have Demo Enhancements

Only do these after the minimum demo works.

- [ ] Camera frame capture
- [ ] Screen/window frame capture
- [ ] Microphone capture
- [ ] Transcript support
- [ ] Overlay message action
- [ ] OBS scene change suggestion mode
- [ ] OBS source visibility suggestion mode
- [ ] Auto-safe scheduled automation
- [ ] Cooldown visualization
- [ ] Recent action timeline
- [ ] Tray/menu-bar behavior
- [ ] Start minimized
- [ ] Auto-start on login
- [ ] Packaged app build

---

## 17. Verification Commands

Run from repository root.

- [ ] `pnpm install`
- [ ] `pnpm --filter @beaverhack/electron build`
- [ ] `pnpm --filter @beaverhack/electron test`
- [ ] `pnpm --filter @beaverhack/electron lint`

---

## 18. Team Ownership

### Person 1: Foundation / Contracts / Security

- [x] Workspace setup
- [x] App boot
- [x] Shared types
- [x] Shared schemas
- [x] Settings service
- [x] Secret store
- [x] Logger service
- [x] IPC helper
- [x] Security docs
- [ ] Build verification

### Person 2: OBS / VTube Studio

- [x] OBS service
- [x] OBS IPC
- [x] OBS UI
- [x] VTS service
- [x] VTS IPC
- [x] VTS UI
- [x] Manual hotkey trigger
- [x] OBS/VTS docs
- [x] OBS/VTS tests

### Person 3: Model / Pipeline / Automation

- [ ] Model provider interface
- [ ] Mock provider
- [ ] OpenRouter provider
- [ ] Self-hosted provider
- [ ] Model router
- [ ] Prompt builder
- [ ] Action plan parser
- [ ] Action validator
- [ ] Cooldown service
- [ ] Action executor
- [ ] Pipeline service
- [ ] Scheduler service
- [ ] Pipeline tests
- [ ] Automation docs

### Person 4: Renderer UX / Capture / Demo Flow

- [x] Renderer app shell
- [x] Status panel
- [x] Settings panel
- [x] Model provider panel
- [x] OBS/VTS panel polish
- [x] Manual control panel
- [x] Log viewer
- [~] Analyze Now UI
- [x] Capture panel
- [x] Hidden capture window
- [x] Capture docs
- [~] Demo polish

---

## 19. Current Risk Tracker

- [~] OBS WebSocket connection not verified on target machines
- [~] VTube Studio auth/token flow not verified
- [~] Electron screen capture permissions may differ by OS
- [ ] Windows capture permissions may require user setup
- [~] Model provider JSON/tool-call behavior may vary by provider
- [~] Real-time capture may be too slow for hackathon demo
- [~] Renderer/main boundary mistakes could break production build
- [~] Secret leakage risk if settings/logs are not carefully redacted
- [~] Team merge conflicts likely around preload API and shared types

---

## 20. Definition Of Done For Any Feature

A feature can be marked `[x]` only when:

- [x] Code compiles
- [x] Types are explicit
- [x] Runtime boundary inputs are validated
- [x] Errors are handled cleanly
- [x] Secrets are not exposed
- [x] Logs are structured
- [x] User can manage or review the feature through UI/status/logs/docs
- [x] Tests are added or updated for non-trivial logic
- [x] Relevant docs are updated
- [x] Feature is verified manually or with tests
