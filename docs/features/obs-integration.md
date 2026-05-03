# OBS Integration

OBS integration is owned by the Electron main process service layer.

Connection state, safe action execution, and user management paths must stay aligned with [SPEC.md](../../SPEC.md).

## Implemented Service Hooks

`electron/src/main/services/obs/obs.service.ts` now exposes model-facing state and execution hooks:

- `getStatus()` returns connection state, current scene, stream/recording status, and full scene/source visibility inventory.
- `setCurrentScene(sceneName)` executes validated scene switches.
- `setSourceVisibility(sceneName, sourceName, visible)` executes validated source visibility changes.

The automation pipeline uses this status to tell the model what OBS actions are currently possible, while validation keeps scene changes in a confirmation-required state by default.
