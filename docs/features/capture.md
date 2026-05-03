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
- The dashboard `Start Service` button starts a low-latency hidden camera/microphone capture path that samples camera frames, records overlapping 1-second media segments every 250ms for clip-mode diagnostics, and runs a 100ms model-monitor scheduler. Model requests can overlap up to a small dispatch cap so vLLM stays focused on recent windows instead of building a stale queue; the dashboard keeps the newest completed request visible.
- The model monitor sends the latest fresh webcam frame as an `image_url` by default for real-time VTS reactions. The clip-mode pipeline can still send a freshly completed webcam `video/mp4` data URL with muxed audio when audio/video evidence is more important than latency.
- The monitor only submits fresh camera media and skips media whose timestamp is older than the live freshness threshold at request time; skipped scheduler ticks mean the next media sample has not arrived yet, the latest sample is too stale for live mode, or the model dispatch cap is full.
- Each dashboard model response includes the media timestamp, pre-model latency, provider request latency, and media-to-response latency so demo operators can tell how current each response is.
- The local vLLM demo provider uses a small output budget with thinking disabled for this real-time loop. The latest response view includes request size and provider token usage to help distinguish media payload overhead from model generation latency.
- Camera and screen capture clips are video-only in the buffer; audio is buffered separately and only muxed with video for manual MP4 export.
- Buffer counts/bytes are displayed so operators can confirm chunks are arriving.
- Screen capture requires a selected desktop source from the capture panel.
- Camera and microphone inputs can be selected from the capture panel.
- The latest buffered camera, screen, audio, and combined video+audio clips can be saved from the capture panel as MP4 for manual testing.

Refer to [SPEC.md](../../SPEC.md) for the full capture design and data contracts.
