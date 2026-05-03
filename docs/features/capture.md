# Capture

Capture features default to privacy-safe behavior and expose clear operational controls from the renderer UI.

## Hidden Capture Window

The hidden capture window runs browser media APIs and streams sampled frames/audio back to the main process.

Flow summary:

- Renderer calls `capture:start` with camera/screen/audio config.
- Renderer can enumerate camera and microphone inputs and choose explicit devices before capture starts.
- Main process creates the hidden capture window and sends `capture:control` start messages.
- Main process grants trusted in-app `media` permission requests for hidden capture windows so Linux camera/microphone capture can start without an interactive prompt from a hidden renderer.
- Main process resolves screen selection through Electron's display-media request handler for `getDisplayMedia`.
- Hidden capture window samples frames/audio and emits `capture:frame` and `capture:audio` payloads.
- Camera and screen also emit short video clips via `capture:clip`.
- Clip recording buffers browser-native media internally and uses ffmpeg-backed MP4 export for saved video, audio, and combined video+audio files.
- Main process buffers capture data for observation building and reports `capture:status` / `capture:status-lite` to the UI.
- Capture status polling in the renderer uses `capture:status-lite` (1s while running, 2s while idle) so frequent updates avoid shipping large preview blobs over IPC.

## Operator Visibility

- The capture panel renders live camera/screen preview streams directly in renderer `<video>` elements (instead of polling frame thumbnails).
- Audio activity is surfaced via a level meter driven by the hidden capture window.
- Buffer counts/bytes are displayed so operators can confirm chunks are arriving.
- Screen capture requires a selected desktop source from the capture panel.
- Camera and microphone inputs can be selected from the capture panel.
- The latest buffered camera, screen, audio, and combined video+audio clips can be saved from the capture panel as MP4 for manual testing.

Refer to [SPEC.md](../../SPEC.md) for the full capture design and data contracts.
