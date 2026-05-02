# AGENTS.md — Beaverhack2026 AI Coder Router

## Purpose

This file defines the workspace-level instructions for AI coding agents working on Beaverhack2026.

Beaverhack2026 is a desktop background agent that observes local streaming context, calls a configured model provider, receives a structured action plan, validates it, and executes approved local actions through OBS and VTube Studio.

Primary implementation flow:

~~~text
Capture inputs -> Build observation -> Call model -> Parse action plan -> Validate actions -> Execute local actions
~~~

Main app location:

~~~text
beaverhack2026/electron
~~~

The root workspace is reserved for documentation, workspace config, shared packages, future apps, scripts, and repository-level coordination.

---

## Required Reading Order

Before making changes, AI coding agents must read:

1. `AGENTS.md`
2. `SPEC.md`
3. Relevant docs under `/docs`
4. Existing code near the change area
5. Existing tests near the change area

Do not edit blindly.

Do not invent architecture that conflicts with the spec.

---

## Workspace Rules

These rules apply across the workspace unless a more specific document overrides them.

### Product Completeness

Every feature must be manageable in practice, not just present in code.

If a feature adds backend capability such as permissions, provisioning, automation, operational workflows, model-provider behavior, local API capability, OBS/VTS actions, or capture controls, the implementation must also include a realistic way for users/operators to use, review, configure, and maintain it.

An API route, IPC method, hidden service, or server action without a supported management path should be treated as incomplete.

For this project, a complete feature usually needs:

- typed service logic
- validated IPC or API boundary
- settings/config support if user-configurable
- UI or documented operational entrypoint
- logs/status visibility
- tests for non-trivial logic
- updated docs

---

### Quality Bar For New Features

New features and major upgrades must be implemented as full-featured, modern product surfaces that can stand beside current industry-standard equivalents.

Do not ship reduced, half-finished, placeholder-grade, or “hacky but works” implementations when the modern expectation clearly includes richer workflows, structured data, operational tooling, review paths, lifecycle states, and polished UX.

If a modern equivalent would normally include management, filtering, detail views, lifecycle states, analytics, applicant/operator/admin workflows, or safe rollback paths, treat those as part of a complete implementation rather than optional stretch work.

For Beaverhack2026, this means:

- model-provider configuration must be testable from the UI
- OBS/VTS connection state must be visible
- automation must be startable/stoppable
- model-generated actions must be reviewable in logs
- unsafe actions must have confirmation or policy controls
- capture features must include privacy controls
- errors must be actionable, not raw stack traces

---

### Loading States

Every user-facing page or materially changed view must have a route-appropriate loading skeleton or state.

Do not rely on a mismatched generic loader for newly created pages or materially changed pages.

If a renderer route, panel, modal, or view can suspend, wait for IPC data, load settings, or depend on external connection state, it needs an appropriate loading state.

When updating a page or panel layout, update its skeleton/loading state to match.

For Electron renderer UI, this applies to views such as:

- setup flow
- settings panel
- status panel
- capture panel
- model provider panel
- OBS/VTS connection panels
- logs viewer
- manual control panel

---

### Type And Boundary Discipline

Keep browser-safe modules browser-safe end to end.

Renderer-safe modules must not import:

- Electron main-process services
- Node-only packages
- secret storage helpers
- OBS/VTS clients directly
- model provider clients directly
- filesystem access
- modules that transitively depend on privileged APIs

Renderer code must communicate through the typed preload IPC API only.

Main-process services own privileged behavior.

Do not pass raw external payloads into narrower helper functions. Construct the exact input object the helper expects.

All trust boundaries must use runtime validation.

Trust boundaries include:

- IPC input
- model provider responses
- imported/exported config
- local API requests
- OBS/VTS event payloads
- capture-window messages
- settings updates

If a feature crosses main/renderer boundaries, verify it with a production build, not only local reasoning.

---

## Documentation Maintenance

### Rule

On successful implementation of any new feature, update the relevant documentation under `/docs` to reflect architecture changes, feature behavior, operational expectations, setup commands, or key locations.

Documentation updates are part of implementation, not follow-up work.

### How To Update Docs

Update the smallest relevant file instead of expanding this root `AGENTS.md`.

Use these locations:

~~~text
docs/standards/     # engineering standards and implementation rules
docs/apps/          # app summaries and app-specific behavior
docs/features/      # feature inventories and feature-level behavior
docs/references/    # code-entry references, setup commands, and operational commands
docs/state/         # cross-app assumptions, deployment notes, migration tracking
~~~

### Duplication Policy

Avoid copying the same guidance into multiple files.

Prefer short overviews that link to deeper docs instead of repeating detail.

Keep root `AGENTS.md` as a router, not a knowledge dump.

If detailed rules are needed, create or update a focused file under `/docs/standards`.

---

## Required Standards Documents

The following docs should exist and be kept current:

~~~text
docs/standards/engineering.md
docs/standards/security.md
docs/standards/ipc.md
docs/standards/model-providers.md
docs/standards/action-plans.md
docs/standards/ui.md
docs/apps/electron.md
docs/features/automation-pipeline.md
docs/features/obs-integration.md
docs/features/vts-integration.md
docs/features/capture.md
docs/references/commands.md
docs/references/repository-structure.md
docs/state/implementation-status.md
~~~

If one of these docs does not exist yet and your change needs it, create it.

If your change affects one of these docs, update it.

---

## Non-Negotiable Engineering Standard

All code must be implemented as production-grade, maintainable, secure, typed, documented software.

Do not write prototype-quality code unless the file is explicitly marked as a temporary spike or mock.

Even mock code must be safe, readable, typed, and easy to replace.

Every change must prioritize:

1. Correct architecture.
2. Strong typing.
3. Secure boundaries.
4. Clear service ownership.
5. Testability.
6. Maintainability.
7. Minimal coupling.
8. Predictable behavior.
9. Clear error handling.
10. Updated documentation.

Do not implement basement-project amateur code.

---

## Repository Layout

Expected workspace structure:

~~~text
beaverhack2026/
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── README.md
├── SPEC.md
├── .gitignore
├── .env.example
│
├── electron/
│   ├── package.json
│   ├── tsconfig.json
│   ├── electron-builder.yml
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main/
│   │   ├── preload/
│   │   ├── renderer/
│   │   └── shared/
│   ├── resources/
│   └── tests/
│
├── apps/
├── packages/
├── docs/
├── models/
└── scripts/
~~~

Do not move the Electron app out of `electron/`.

Do not add unrelated applications under `electron/`.

Future apps belong in `apps/`.

Reusable shared packages belong in `packages/`.

---

## Architecture Boundaries

The application uses these boundaries:

| Layer | Owns |
|---|---|
| Electron main process | privileged services, settings, secrets, model calls, OBS/VTS clients, validation, execution |
| Electron renderer | setup UI, status UI, controls, logs, user interaction |
| Preload bridge | typed and limited IPC surface |
| Hidden capture window | browser media APIs and local capture |
| Shared types/schemas | runtime contracts and validation schemas |

The model may suggest actions.

The app validates and executes actions.

The renderer must never directly execute privileged behavior.

---

## Core Runtime Flow

All model-generated automation must follow this flow:

~~~text
1. Scheduler or manual trigger starts a pipeline tick.
2. ObservationBuilder creates an ObservationEnvelope.
3. PromptBuilder creates model messages and tool schemas.
4. ModelRouter calls the configured provider.
5. ActionPlanParser extracts an ActionPlan.
6. ActionValidator validates schema, policy, cooldowns, and autonomy level.
7. ActionExecutor executes approved actions.
8. Logger records meaningful outcomes.
9. Renderer receives updated status/log events.
~~~

Do not bypass this pipeline for model-generated actions.

Manual UI actions may call services directly only when they are explicit user actions, such as:

- Connect OBS
- Connect VTube Studio
- Test VTS hotkey
- Test model provider connection
- Start capture
- Stop capture

---

## Security Requirements

Security is mandatory.

Renderer code must not access:

- model API keys
- OBS passwords
- VTube Studio auth tokens
- local API bearer tokens
- raw secret-store values
- Node.js APIs directly
- filesystem APIs directly
- model provider clients directly
- OBS/VTS clients directly

Renderer code must communicate through the preload bridge only.

All renderer windows must use secure defaults:

~~~typescript
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: path.join(__dirname, "preload.js"),
  },
});
~~~

Do not enable `nodeIntegration`.

Do not disable `contextIsolation`.

Do not disable `sandbox` unless there is a documented and reviewed reason.

Secrets must be handled only by main-process services.

Never log secrets.

Never expose secrets to renderer.

Never include secrets in docs, screenshots, fixtures, test snapshots, or sample outputs.

---

## TypeScript And Code Style

Required style:

- TypeScript.
- Strict typing.
- Two-space indentation.
- Semicolons.
- Explicit exported types for public interfaces.
- `React.JSX.Element` for React component return types.
- Zod validation at runtime boundaries.
- `unknown` instead of `any` for untrusted data.
- Discriminated unions for action types.
- Typed IPC request/response contracts.
- Typed provider interfaces.
- `try/catch` around async service boundaries.
- No hardcoded secrets.
- No commented-out dead code.
- No vague TODOs.
- No magic strings for action types when typed constants/unions are available.

Avoid `any`.

If `any` is unavoidable, document why.

---

## IPC Rules

IPC is a trust boundary.

Every IPC handler must:

1. Validate input with Zod.
2. Reject unknown fields.
3. Call a main-process service.
4. Return a typed success/error result.
5. Never return secrets.
6. Never throw raw errors to renderer.
7. Log meaningful failures.

IPC channel names must use this format:

~~~text
domain:operation
~~~

Examples:

~~~text
automation:start
automation:stop
automation:analyze-now
capture:get-sources
obs:connect
vts:authenticate
model:test-connection
settings:update
logs:list
~~~

---

## Model And Action Rules

Model calls must go through `ModelRouter`.

Do not call OpenRouter, self-hosted endpoints, or any model API directly from UI components or unrelated services.

All model-generated behavior must go through:

~~~text
ModelRouter -> ActionPlanParser -> ActionPlan schema -> ActionValidator -> ActionExecutor
~~~

Never execute:

- raw model text
- arbitrary model-provided tool names
- unvalidated JSON
- model-generated code

Supported action types:

~~~text
vts.trigger_hotkey
vts.set_parameter
obs.set_scene
obs.set_source_visibility
overlay.message
log.event
noop
~~~

Each action must include:

- `type`
- `actionId`
- `reason`

Every executed, skipped, failed, or blocked action must be logged.

---

## Config Rules

Default config must be safe.

Required safe defaults:

~~~text
screen capture disabled
raw audio sending disabled
local API disabled
OBS scene changes require confirmation
OBS source visibility changes require confirmation
VTS parameter changes require confirmation
VTS hotkeys allowed in auto_safe
overlay messages allowed in auto_safe
~~~

Do not add a new config field without updating:

1. Type.
2. Schema.
3. Default config.
4. Settings UI if user-facing.
5. Relevant docs.

---

## Testing Rules

Tests are required for non-trivial logic.

Minimum tested areas:

- Zod schemas
- ActionPlanParser
- ActionValidator
- CooldownService
- ModelRouter fallback behavior
- PromptBuilder
- SettingsService
- Secret redaction
- IPC validation
- PipelineService with mock provider

Do not require real OBS, real VTube Studio, real OpenRouter, or a real model provider for unit tests.

Use mocks.

---

## Build And Verification

Before considering work complete, run relevant checks from the repository root:

~~~bash
pnpm install
pnpm --filter @beaverhack/electron build
pnpm --filter @beaverhack/electron test
pnpm --filter @beaverhack/electron lint
~~~

If a command cannot run, document why.

Do not claim verification was completed unless it actually ran successfully.

---

## Architecture Change Rule

Do not change architecture casually.

Architecture changes include:

- moving services between layers
- changing the pipeline flow
- changing action execution rules
- changing IPC boundaries
- changing model provider interfaces
- changing secret handling
- changing config structure
- changing repository structure
- adding a new app
- moving shared types into packages
- adding local API capability

Any architecture change must update:

- `SPEC.md`
- relevant docs under `/docs`
- `AGENTS.md` if workspace rules or routing changes

---

## AI Coding Agent Behavior

When acting as an AI coding agent in this repo:

1. Read this file first.
2. Read `SPEC.md` before architecture work.
3. Read relevant `/docs` files before implementation.
4. Inspect existing files before editing.
5. Preserve architecture boundaries.
6. Make the smallest correct change.
7. Update relevant docs in the same change.
8. Add or update tests for logic changes.
9. Do not invent APIs without checking existing types.
10. Do not expose secrets.
11. Do not bypass validation.
12. Do not place privileged logic in the renderer.
13. Do not execute model-generated actions without validation.
14. Do not leave broken imports.
15. Do not leave stale docs.
16. Do not mark work complete without verification.

If requirements are unclear, make the safest implementation consistent with this file and document assumptions.

---

## Definition Of Done

A change is complete only when:

- Code compiles.
- Tests are added or updated when needed.
- Relevant docs are updated.
- Types and schemas are consistent.
- IPC inputs are validated.
- Errors are handled.
- Secrets are protected.
- Logs are structured.
- Loading states are included for affected user-facing views.
- Product management paths exist for new capabilities.
- Architecture boundaries are preserved.
- The change is reviewable.
- `AGENTS.md` is updated if workspace rules or routing changed.

If any item cannot be completed, document the reason clearly.