## Recommended 4-person split

| Person   | Main ownership                                          | Why this is parallelizable                                                              |
| -------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Person 1 | App foundation, contracts, settings, logs, IPC patterns | Everyone depends on stable shared types, schemas, IPC result shapes, logger, and config |
| Person 2 | OBS + VTube Studio integrations                         | Can build against shared `ObsStateSnapshot`, `VtsStateSnapshot`, and manual IPC calls   |
| Person 3 | Model provider + action pipeline                        | Can use mock OBS/VTS state and mock provider before real integrations are done          |
| Person 4 | Renderer UX + capture/demo flow                         | Can build panels against mocked preload APIs, then connect to real IPC later            |

The important part: **each person owns a vertical slice**, not just files. For example, the OBS person should not only write `obs.service.ts`; they should also own `obs.ipc.ts`, `useOBS.ts`, OBS status UI, logs, and basic tests.

---

## Phase 0: everyone aligns on contracts first

Before splitting hard, spend the first block getting the skeleton and interfaces stable.

Person 1 should quickly create:

```text
electron/src/shared/types/*
electron/src/shared/schemas/*
electron/src/main/services/logger/logger.service.ts
electron/src/main/services/settings/settings.service.ts
electron/src/main/services/settings/secret-store.service.ts
electron/src/preload/index.ts
electron/src/renderer/types/electron-api.d.ts
```

Everyone else can start with mocks while this lands. The spec already defines the major service boundaries: renderer talks through preload IPC, main owns privileged services, hidden capture owns browser media APIs, and shared types/schemas define runtime contracts.

---

## Person 1: Foundation / integration lead

Owns the parts everyone depends on.

### Tasks

- [x] Create Electron + Vite + React skeleton.
- [x] Add root workspace files.
- [ ] Add shared result type, probably ApiResult<T>.
- [ ] Add shared schemas for config, observation, action plan.
- [ ] Add SettingsService.
- [ ] Add SecretStoreService.
- [ ] Add LoggerService.
- [ ] Add typed IPC registration helpers.
- [ ] Add secure BrowserWindow defaults.
- [ ] Add base renderer shell.
- [ ] Add LogViewer plumbing.
- [ ] Add docs/references/commands.md.
- [ ] Keep implementation-status.md updated.

### Deliverable

```text
The app launches, settings load, logs work, preload API exists, and other teammates have stable contracts to build against.
```

This person should be careful not to become the bottleneck forever. Their first job is to unblock others, not to perfect everything.

---

## Person 2: OBS + VTube Studio integration

Owns local streaming tool control.

### Tasks

```text
- Implement OBSService.
- Implement obs.ipc.ts.
- Implement useOBS.ts.
- Add OBS connection/status UI.
- Read current scene.
- Read stream/recording status.
- Add connect/disconnect controls.
- Implement VTSService.
- Implement vts.ipc.ts.
- Implement useVTS.ts.
- Add VTS connection/authentication UI.
- Fetch hotkey list.
- Add manual hotkey trigger UI.
- Log connection/auth/action results.
```

### Deliverable

```text
User can connect to OBS, connect/authenticate VTube Studio, see status, see hotkeys, and manually trigger a VTS hotkey.
```

This is crucial for the demo because the minimum target requires connecting to OBS, connecting/authenticating VTube Studio, fetching hotkeys, and triggering a VTS hotkey.

---

## Person 3: Model provider + automation pipeline

Owns the brain and safety path.

### Tasks

```text
- Implement ModelProvider interface.
- Implement mock provider first.
- Implement OpenRouter provider.
- Implement self-hosted OpenAI-compatible provider.
- Implement ModelRouter with fallback behavior.
- Implement PromptBuilder.
- Implement ActionPlanParser.
- Implement ActionValidator.
- Implement CooldownService.
- Implement ActionExecutor.
- Implement PipelineService.
- Implement SchedulerService.
- Add model:test-connection IPC.
- Add automation:start/stop/analyze-now IPC.
- Add tests for parser, validator, cooldown, router fallback, and pipeline with mock provider.
```

### Deliverable

```text
Analyze Now can call the mock or real provider, parse an ActionPlan, validate it, execute allowed actions, block unsafe actions, and log the full result.
```

Do **not** let this person directly call OBS/VTS from random model code. The project explicitly requires model-generated behavior to go through `ModelRouter -> ActionPlanParser -> ActionPlan schema -> ActionValidator -> ActionExecutor`.

---

## Person 4: Renderer UX + capture/demo flow

Owns the user-facing product surface and later capture.

### Tasks

```text
- Build App.tsx shell.
- Build StatusPanel.
- Build SettingsPanel.
- Build ModelProviderPanel.
- Build ManualControlPanel.
- Build CapturePanel.
- Build LogViewer.
- Add loading states for IPC-backed panels.
- Add setup flow for first run.
- Add Analyze Now button and pipeline result display.
- Add privacy language for capture toggles.
- Implement hidden capture window after the basic model-to-VTS loop works.
- Add camera/screen/audio status UI.
```

### Deliverable

```text
The app feels usable: setup, status, model config, OBS/VTS controls, Analyze Now, logs, and capture toggles are visible and understandable.
```

Capture should probably be **second-wave**, not first-wave. The spec’s minimum complete demo says camera, screen, and audio capture can be added after the basic model-to-VTS loop works.

---

## Best implementation order for parallel work

### Milestone 1: “App boots and contracts exist”

```text
Person 1:
  Skeleton, preload, shared types, schemas, settings, logs.

Person 2:
  Stub OBS/VTS services against the planned interfaces.

Person 3:
  Mock provider, ActionPlan schema, parser skeleton.

Person 4:
  Renderer shell with mocked panels and loading states.
```

Goal:

```text
pnpm dev opens an Electron window.
Logs render.
Settings render.
Mock data can flow from main to renderer.
```

---

### Milestone 2: “Manual controls work”

```text
Person 2:
  Real OBS connect/status.
  Real VTS connect/auth/hotkeys.

Person 3:
  Model test connection.
  Mock ActionPlan generation.
  Validator and executor.

Person 4:
  OBS/VTS panels.
  Manual hotkey test panel.
  Model provider panel.

Person 1:
  IPC hardening, error shape, docs, build fixes.
```

Goal:

```text
User can connect to OBS/VTS and manually trigger a VTS hotkey.
```

---

### Milestone 3: “Analyze Now demo works”

```text
Person 3:
  PipelineService end-to-end.
  ObservationBuilder using OBS/VTS state.
  PromptBuilder.
  ModelRouter.
  ActionPlanParser.
  ActionValidator.
  ActionExecutor.

Person 2:
  Make OBS/VTS services return reliable snapshots.
  Make VTS hotkey execution robust.

Person 4:
  Analyze Now button.
  Pipeline result card.
  Log viewer polish.

Person 1:
  Tests, docs, packaging/build stability.
```

Goal:

```text
Click Analyze Now -> model returns action plan -> validator approves -> VTS hotkey fires -> result appears in logs.
```

That basically hits the minimum demo target.

---

### Milestone 4: “Automation and capture”

```text
Person 3:
  SchedulerService.
  Cooldowns.
  Recent action history.
  Autonomy levels.

Person 4:
  CapturePanel.
  Hidden capture window UI flow.
  Privacy toggles.

Person 1:
  Capture IPC validation.
  Security docs.
  Settings persistence.

Person 2:
  OBS scene/source actions, but keep confirmation required by default.
```

Goal:

```text
Automation can run safely in auto_safe, capture has user-visible privacy controls, and risky OBS/VTS actions are blocked or require confirmation.
```

Safe defaults matter here: screen capture disabled, raw audio sending disabled, local API disabled, OBS changes requiring confirmation, and VTS hotkeys/overlay messages allowed in `auto_safe`.

---

## Suggested branch strategy

Use branches like:

```text
foundation/app-shell
feature/obs-vts-integrations
feature/model-pipeline
feature/renderer-demo-flow
feature/capture
```

Avoid everyone editing the same files constantly. The danger files are:

```text
electron/src/preload/index.ts
electron/src/renderer/types/electron-api.d.ts
electron/src/shared/types/*
electron/src/shared/schemas/*
electron/src/renderer/App.tsx
```

For those, either Person 1 owns the changes or everyone coordinates before touching them.

---

## Practical rule for merge order

Merge in this order:

```text
1. Foundation contracts
2. Logger/settings/preload API
3. OBS/VTS manual integration
4. Model mock + parser/validator
5. Renderer panels
6. Pipeline Analyze Now
7. Scheduler automation
8. Capture
```

Do **not** wait for OBS, VTS, and model providers to all be real before testing. Use mocks aggressively. The AGENTS rules specifically say tests should not require real OBS, real VTube Studio, real OpenRouter, or a real provider.
