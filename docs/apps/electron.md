# Electron App

The Electron app lives in [`electron/`](../../electron) and is the primary implementation target for AuTuber.

Architecture and target structure are defined in [SPEC.md](../../SPEC.md).

Renderer styling currently uses the Sakura Candy Pop palette: sakura pink as the primary brand color, miku cyan for focus/interaction, and light neutral surfaces with soft pink, lavender, and mint accents. The shared theme tokens live in `electron/src/renderer/styles/globals.css`.

Current persistence behavior:

- App configuration is stored in the Electron main process through `electron-store`.
- VTube Studio connection settings persist across renderer navigation and app relaunches.
- VTube Studio prompt emote mappings persist as part of VTS settings. Each mapping stores the local hotkey ID plus the user-facing prompt name, prompt description, and enabled state.
- Dashboard capture source selections persist across renderer navigation and app relaunches.
- Dashboard AFK overlay settings persist as `afkOverlay`, including enabled state, selected OBS scene/source, and the AFK debounce delay.
- The selected model provider persists in the same settings store.
- The model monitor stores its last successful start request and resumes on next launch when it was previously left running.

Current live automation behavior:

- The dashboard model monitor now uses the canonical automation pipeline instead of a model-only visibility loop.
- Live monitor ticks attach the latest buffered webcam/audio clip to the model request and execute approved VTS hotkeys automatically.
- Model-generated OBS actions remain excluded from the live monitor path until an OBS confirmation workflow is added.
- The live monitor can show/hide the configured AFK overlay OBS source when the model emits the local `vacant` AFK signal and AFK overlay automation is enabled.
- Startup service activation now attempts to bring OBS and VTube Studio online automatically and retries when those desktop apps launch after AuTuber.
