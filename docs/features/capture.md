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
- The dashboard renders the selected camera and screen source directly in renderer `<video>` elements and shows the selected microphone through a local level meter/waveform.
- The dashboard `Start Service` button starts a low-latency hidden camera/microphone capture path with 2-second media segments and runs a 500ms model-monitor scheduler.
- The model monitor currently sends the latest freshly completed 2-second webcam `video/mp4` data URL, muxes audio into the MP4, and enables `use_audio_in_video`, matching the working standalone audio/video test as closely as possible while screen media is held out for isolation. It displays only the latest paired model video/response in the dashboard without executing actions yet.
- The monitor only submits a newly completed camera clip once and skips clips whose end time is older than 1.5 seconds at request time; skipped scheduler ticks mean either the previous request is still running, the next media segment has not closed yet, or the latest segment is too stale for live mode.
- Each dashboard model response includes the capture window start/end time, conversion latency, model request latency, and clip-end-to-response latency so demo operators can tell how current each response is.
- The local vLLM demo provider uses a small output budget with thinking disabled for this real-time loop. The latest response view includes request size and provider token usage to help distinguish media payload overhead from model generation latency.
- Camera and screen capture clips are video-only in the buffer; audio is buffered separately and only muxed with video for manual MP4 export.
- Buffer counts/bytes are displayed so operators can confirm chunks are arriving.
- Screen capture requires a selected desktop source from the capture panel.
- Camera and microphone inputs can be selected from the capture panel.
- The latest buffered camera, screen, audio, and combined video+audio clips can be saved from the capture panel as MP4 for manual testing.

Refer to [SPEC.md](../../SPEC.md) for the full capture design and data contracts.
