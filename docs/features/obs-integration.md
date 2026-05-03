# OBS Integration

OBS integration is owned by the Electron main process service layer.

Connection state, safe action execution, and user management paths must stay aligned with [SPEC.md](../../SPEC.md).

## Implemented Service Hooks

`electron/src/main/services/obs/obs.service.ts` now exposes model-facing state and execution hooks:

- `getStatus()` returns connection state, current scene, stream/recording status, and full scene/source visibility inventory.
- `setCurrentScene(sceneName)` executes validated scene switches.
- `setSourceVisibility(sceneName, sourceName, visible)` executes validated source visibility changes.

The automation pipeline uses this status to tell the model what OBS actions are currently possible, while validation keeps scene changes in a confirmation-required state by default.

## AFK Overlay Automation

The dashboard exposes an AFK overlay selector backed by `obs:get-status`.

Operators can select:

- whether AFK overlay automation is enabled
- the OBS scene that contains the overlay source
- the OBS source to show/hide
- the debounce delay before the app shows the overlay

The app does not rely on a fixed source name. The default `afkOverlay` config is disabled with no selected scene/source.

Live camera automation treats the model's `cueLabels: ["vacant"]` response as an AFK signal. `AfkOverlayService` also accepts explicit no-person/no-people-detected model text as the same local signal so a provider `noop` does not suppress the configured BRB overlay. The service handles that signal locally by showing the configured OBS source after the debounce delay and hiding the same source when the person returns. This deterministic action is separate from model-generated OBS scene/source actions, which still require confirmation.

When an AFK signal is detected but the overlay cannot be controlled, the live monitor log reports the local reason, such as disabled AFK overlay automation, disconnected OBS, or a selected scene/source that is not present in the latest OBS scene inventory.

## Activation And Retry

OBS activation now follows the same startup service-activation path as VTube Studio.

Current behavior:

- The Electron main process attempts OBS activation during app startup.
- If OBS is not running yet, the app schedules automatic retry attempts in the background.
- Manual retry is exposed in the renderer through the runtime Status view.

The current OBS retry path still uses the default `localhost:4455` target because a user-facing OBS connection settings surface has not been added yet.
