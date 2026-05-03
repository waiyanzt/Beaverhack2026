# OBS Integration

OBS integration is owned by the Electron main process service layer.

Connection state, safe action execution, and user management paths must stay aligned with [SPEC.md](../../SPEC.md).

## Implemented Service Hooks

`electron/src/main/services/obs/obs.service.ts` now exposes model-facing state and execution hooks:

- `getStatus()` returns connection state, current scene, stream/recording status, and full scene/source visibility inventory.
- `setCurrentScene(sceneName)` executes validated scene switches.
- `setSourceVisibility(sceneName, sourceName, visible)` executes validated source visibility changes.

The automation pipeline uses this status to tell the model what OBS actions are currently possible, while validation keeps scene changes in a confirmation-required state by default.

## Activation And Retry

OBS activation now follows the same startup service-activation path as VTube Studio.

Current behavior:

- The Electron main process attempts OBS activation during app startup.
- If OBS is not running yet, the app schedules automatic retry attempts in the background.
- Manual retry is exposed in the renderer through the runtime Status view.

The current OBS retry path still uses the default `localhost:4455` target because a user-facing OBS connection settings surface has not been added yet.
