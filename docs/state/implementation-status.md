# Beaverhack2026 Implementation Checklist

## Status Legend

- `[x]` done
- `[~]` in progress
- `[ ]` not started

A feature is only complete when it has the needed service logic, typed IPC/API boundary, UI/status path, logs, tests where applicable, and docs.

---

## 0. Minimum Demo Checklist

- [~] App launches
- [ ] User can connect to OBS
- [ ] User can connect to VTube Studio
- [ ] User can authenticate VTube Studio plugin
- [ ] App fetches VTS hotkeys
- [ ] User can configure model provider
- [ ] User can test model provider connection
- [~] User can click Analyze Now
- [~] App builds observation using OBS state and VTS state
- [~] App sends prompt to model provider
- [~] Model returns structured ActionPlan
- [~] App parses ActionPlan
- [~] App validates ActionPlan
- [~] App blocks unsafe actions
- [ ] App triggers allowed VTS hotkey
- [~] App logs full pipeline result
- [~] User can review action results in LogViewer

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

- [x] Implement `settings:get`
- [x] Implement `settings:update`
- [x] Implement `logs:list`
- [ ] Implement `logs:clear`
- [ ] Implement `logs:event`
- [x] Implement `obs:connect`
- [x] Implement `obs:disconnect`
- [x] Implement `obs:get-status`
- [x] Implement `vts:connect`
- [x] Implement `vts:disconnect`
- [x] Implement `vts:authenticate`
- [x] Implement `vts:get-hotkeys`
- [x] Implement `vts:trigger-hotkey`
- [x] Implement `model:test-connection`
- [x] Implement `model:set-provider`
- [x] Implement `model:list-providers`
- [x] Implement `automation:start`
- [x] Implement `automation:stop`
- [x] Implement `automation:analyze-now`
- [x] Implement `automation:get-status`
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
- [~] Add app loading state
- [~] Add first-run setup state
- [~] Add global error display
- [x] Add light/dark compatible base styling

### Panels

- [x] Create `StatusPanel.tsx`
- [x] Create `SettingsPanel.tsx`
- [x] Create `ModelProviderPanel.tsx`
- [x] Create `CapturePanel.tsx`
- [x] Create `ManualControlPanel.tsx`
- [x] Create `HotkeyMapper.tsx`
- [x] Create `LogViewer.tsx`
- [~] Add loading skeleton for status panel
- [~] Add loading skeleton for settings panel
- [~] Add loading skeleton for model provider panel
- [~] Add loading skeleton for capture panel
- [~] Add loading skeleton for logs viewer
- [~] Add empty states
- [~] Add actionable error states

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

- [x] Implement `setCurrentScene`
- [x] Implement `setSourceVisibility`
- [x] Require confirmation for scene changes by default
- [x] Require confirmation for source visibility changes by default
- [x] Log all OBS actions
- [x] Log all blocked OBS actions

### OBS UI

- [x] Add OBS connect button
- [x] Add OBS disconnect button
- [x] Show OBS connection status
- [x] Show current scene
- [x] Show stream status
- [x] Show recording status
- [x] Show OBS errors in user-friendly language

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
- [x] Implement optional `setParameter`
- [x] Keep `vts.trigger_hotkey` allowed in `auto_safe`
- [x] Require confirmation for `vts.set_parameter`
- [x] Log all VTS actions
- [x] Log all blocked VTS actions

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
- [x] Log provider errors without exposing API keys
- [x] Add ModelRouter fallback tests

### Model UI

- [x] Add provider selector
- [x] Add model name field
- [x] Add base URL field
- [x] Add API key field with secret-safe behavior
- [x] Add provider capability display
- [x] Add test connection button
- [x] Show provider test result
- [x] Show provider failure logs

---

## 9. Prompt And Action Plan Pipeline

### Prompt Builder

- [x] Create `prompt-builder.service.ts`
- [x] Add system prompt template
- [x] Build observation summary for model
- [x] Build tool schemas based on policy
- [x] Ensure prompt excludes secrets
- [x] Add PromptBuilder tests

### Action Plan Tool

- [x] Create `create_action_plan` tool schema
- [x] Enforce required `actions`
- [x] Enforce required `safety`
- [x] Enforce required `nextTick`
- [x] Add tests for valid tool schema

### Action Plan Parser

- [x] Create `action-plan-parser.service.ts`
- [x] Parse tool call response
- [x] Parse JSON response fallback if needed
- [x] Attach observation `tickId`
- [x] Validate parsed plan with Zod
- [x] Return safe parse errors
- [x] Log parse failures
- [x] Add parser tests

### Action Validator

- [x] Create `action-validator.service.ts`
- [x] Validate schema
- [x] Enforce `maxActionsPerTick`
- [x] Enforce allowed action list
- [x] Enforce blocked action list
- [x] Enforce action-specific validation
- [x] Enforce cooldowns
- [x] Enforce autonomy level
- [x] Require confirmation for high-risk actions
- [x] Return blocked action results
- [x] Log blocked action reasons
- [x] Add validator tests

### Cooldown Service

- [x] Create `cooldown.service.ts`
- [x] Track global action cooldown
- [x] Track per-action cooldown
- [x] Track repeated VTS hotkey cooldown
- [x] Add cooldown tests

### Action Executor

- [x] Create `action-executor.service.ts`
- [x] Execute `vts.trigger_hotkey`
- [x] Execute `vts.set_parameter`
- [x] Execute `obs.set_scene`
- [x] Execute `obs.set_source_visibility`
- [x] Execute `overlay.message`
- [x] Execute `log.event`
- [x] Execute `noop`
- [x] Return `LocalActionResult` for every action
- [x] Handle partial action failure
- [x] Log executed actions
- [x] Add executor tests with mocked OBS/VTS

### Pipeline Service

- [x] Create `pipeline.service.ts`
- [x] Build observation
- [x] Build prompt
- [x] Call model router
- [x] Parse action plan
- [x] Validate action plan
- [x] Execute approved actions
- [x] Return completed result
- [x] Return blocked result
- [x] Return failed result
- [x] Log pipeline tick start/end
- [x] Add pipeline tests with mock provider

---

## 10. Observation Builder

### Observation Envelope

- [x] Create `observation-builder.service.ts`
- [x] Generate session ID
- [x] Generate tick ID
- [x] Add created timestamp
- [x] Add source metadata
- [x] Add OBS snapshot
- [x] Add VTS snapshot
- [x] Add runtime snapshot
- [x] Add runtime policy
- [x] Add recent action history
- [x] Add optional user text
- [x] Add optional camera frames
- [x] Add optional screen/window frames
- [x] Add optional audio chunks
- [x] Add optional transcript segments
- [x] Validate final ObservationEnvelope
- [x] Add observation builder tests

### Runtime Policy

- [x] Implement `paused`
- [x] Implement `suggest_only`
- [x] Implement `auto_safe`
- [x] Implement `auto_full`
- [x] Implement `safe_mode`
- [x] Default allowed actions to VTS hotkey, overlay message, log event, noop
- [x] Default blocked actions to OBS scene, OBS source visibility, VTS parameter
- [x] Add runtime policy tests

---

## 11. Automation

### Scheduler

- [x] Create `scheduler.service.ts`
- [x] Start automation loop
- [x] Stop automation loop
- [x] Respect `tickIntervalMs`
- [x] Prevent overlapping ticks
- [x] Trigger pipeline on timer
- [x] Trigger pipeline on manual Analyze Now
- [x] Support OBS event trigger
- [x] Support VTS event trigger
- [x] Support capture event trigger
- [x] Add scheduler tests

### Automation UI

- [x] Add start automation button
- [x] Add stop automation button
- [x] Add Analyze Now button
- [x] Add autonomy level selector
- [x] Show automation enabled/disabled status
- [x] Show last tick status
- [x] Show recent action history
- [x] Show blocked action visibility
- [x] Show cooldown state
- [x] Show safe mode state

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

- [x] Create `electron/src/main/local-api/server.ts`
- [x] Create `electron/src/main/local-api/routes.ts`
- [x] Create `electron/src/main/local-api/auth.ts`
- [x] Keep local API disabled by default
- [x] Bind only to `100.93.134.64`
- [x] Require bearer token
- [x] Validate all request bodies
- [x] Never expose secrets
- [x] Never allow unauthenticated action execution
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
- [~] Document current implementation status

---

## 15. Tests

### Unit Tests

- [x] Add Zod schema tests
- [x] Add ActionPlanParser tests
- [x] Add ActionValidator tests
- [x] Add CooldownService tests
- [x] Add ModelRouter fallback tests
- [x] Add PromptBuilder tests
- [x] Add SettingsService tests
- [x] Add secret redaction tests
- [x] Add IPC validation tests
- [x] Add PipelineService tests with mock provider

### Integration Tests

- [ ] Add mocked OBS integration tests
- [ ] Add mocked VTS integration tests
- [ ] Add model-provider mock integration tests
- [ ] Add renderer/preload boundary tests if practical

### E2E / Demo Tests

- [~] App launches
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
- [~] Pipeline result appears in logs

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

- [x] Model provider interface
- [x] Mock provider
- [x] OpenRouter provider
- [x] Self-hosted provider
- [x] Model router
- [x] Prompt builder
- [x] Action plan parser
- [x] Action validator
- [x] Cooldown service
- [x] Action executor
- [x] Pipeline service
- [x] Scheduler service
- [x] Pipeline tests
- [x] Automation docs

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

