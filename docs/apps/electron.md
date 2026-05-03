# Electron App

The Electron app lives in [`electron/`](../../electron) and is the primary implementation target for AuTuber.

Architecture and target structure are defined in [SPEC.md](../../SPEC.md).

Current persistence behavior:

- App configuration is stored in the Electron main process through `electron-store`.
- VTube Studio connection settings persist across renderer navigation and app relaunches.
- Dashboard capture source selections persist across renderer navigation and app relaunches.
- The selected model provider persists in the same settings store.
- The model monitor stores its last successful start request and resumes on next launch when it was previously left running.
