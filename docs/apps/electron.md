# Electron App

The Electron app lives in [`electron/`](../../electron) and is the primary implementation target for AuTuber.

Architecture and target structure are defined in [SPEC.md](../../SPEC.md).

Current persistence behavior:

- App configuration is stored in the Electron main process through `electron-store`.
- VTube Studio connection settings persist across renderer navigation and app relaunches.
- Dashboard capture source selections persist across renderer navigation and app relaunches.
- The selected model provider persists in the same settings store.
- The model monitor stores its last successful start request and resumes on next launch when it was previously left running.

Current live automation behavior:

- The dashboard model monitor now uses the canonical automation pipeline instead of a model-only visibility loop.
- Live monitor ticks attach the latest buffered webcam/audio clip to the model request and execute approved VTS hotkeys automatically.
- OBS actions remain excluded from the live monitor path until an OBS confirmation workflow is added.
- Startup service activation now attempts to bring OBS and VTube Studio online automatically and retries when those desktop apps launch after AuTuber.
