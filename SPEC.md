# Beaverhack2026 — VTuber AI Integration Platform

## 1. Overview

Beaverhack2026 is a real-time VTuber AI integration platform that connects multimodal user inputs (video, audio, screen capture, text) to a backend multimodal LLM (Nemotron Nano Omni v3) and drives VTube Studio avatar reactions via hotkey triggers and, eventually, WebSocket-based parameter control. The application is built as an Electron desktop app with a Next.js + React frontend, communicating with the LLM backend over an OpenAI-compatible REST API on port `8000`.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Electron Desktop App                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Next.js + React Frontend                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │  Video   │ │  Audio   │ │  Screen  │ │  OBS Scene Info  │  │  │
│  │  │ Capture  │ │ Capture  │ │ Capture  │ │  (via obs-websocket)│  │
│  │  └────┬─────┘ └─────┬────┘ └──────┬───┘ └─────────┬────────┘  │  │
│  │       └─────────────┴─────────────┴───────────────┘           │  │
│  │                          ▼                                    │  │
│  │              Input Pipeline / Sampler                         │  │
│  │       (frame sampling, audio chunking, text assembly)         │  │
│  │                          ▼                                    │  │
│  │              Preprocessor (OpenAI format)                     │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │ HTTP POST                             │
│                             ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              LLM Backend (Port 8000)                          │  │
│  │         Nemotron Nano Omni v3 — OpenAI-compatible API         │  │
│  │  • /v1/chat/completions                                       │  │
│  │  • /v1/audio/transcriptions (optional, start without)         │  │
│  │  • Supports tool calling, JSON output, CoT, timestamps        │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │ Tool call responses                   │
│                             ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Tool Call Router / Dispatcher                    │  │
│  │  ┌────────────────────┐  ┌────────────────────────────────┐  │  │
│  │  │  VTube Studio      │  │  Future: WebSocket Param Control│  │  │
│  │  │  Hotkey Sender     │  │  (face params, physics, etc.)  │  │  │
│  │  │  (HTTP / UDP)      │  │                                │  │  │
│  │  └────────────────────┘  └────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer              | Technology                                  |
|--------------------|---------------------------------------------|
| Desktop Shell      | Electron 33+                                |
| Frontend Framework | Next.js 15 (App Router) + React 19          |
| UI Components      | Tailwind CSS |
| State Management   | Start with native React                                |
| IPC                | Electron IPC (main ↔ renderer)              |
| Video Capture      | `electron.desktopCapturer` + MediaRecorder   |
| Audio Capture      | `navigator.mediaDevices.getUserMedia`        |
| Screen Capture     | `electron.desktopCapturer`                  |
| OBS Integration    | `obs-websocket` (v5+) protocol              |
| VTube Studio API   | VTS Public API (UDP + JSON over TCP, port 8001) |
| LLM Backend        | Nemotron Nano Omni v3 (OpenAI-compatible, port 8000) |
| Build / Bundle     | Vite (via Next.js), Electron Builder        |

---

## 4. Input Specifications

### 4.1 Video

| Property        | Value                                                                 |
|-----------------|-----------------------------------------------------------------------|
| Format          | MP4 (H.264/H.265)                                                     |
| Max Duration    | 2 minutes                                                             |
| Resolution      | 1080p (1920×1080) or 720p (1280×720)                                  |
| Frame Sampling  | 1080p: up to 1 FPS / 128 frames max; 720p: up to 2 FPS / 256 frames max |
| Color Space     | RGB (JPEG/PNG encoded frames)                                         |
| Dimensionality  | 3D (H × W × C)                                                        |

**Capture Pipeline:**
1. `desktopCapturer.getSources({ types: ['screen', 'window'] })` enumerates sources.
2. User selects a source; a `MediaStream` is created via `navigator.mediaDevices.getUserMedia` with the chosen `MediaStreamSource`.
3. Frames are extracted using a `<video>` element + `canvas.getContext('2d').drawImage()` at the target sampling rate.
4. Each sampled frame is encoded as base64 JPEG or PNG and stored as a `image_url` content part in the OpenAI message payload.
5. Frames are buffered in a rolling window; when a request is triggered, the most recent N frames (up to 128/256) are included.

### 4.2 Audio

| Property        | Value                                      |
|-----------------|--------------------------------------------|
| Format          | WAV, MP3                                   |
| Max Duration    | 1 hour                                     |
| Sample Rate     | 8 kHz minimum (16 kHz or 48 kHz preferred) |
| Channels        | Mono or Stereo                             |
| Dimensionality  | 1D (time-series waveform)                  |

**Capture Pipeline:**
1. `navigator.mediaDevices.getUserMedia({ audio: true })` captures microphone audio.
2. Audio is recorded in chunks using `MediaRecorder` with `mimeType: 'audio/webm'` (or `audio/wav` if supported).
3. Chunks are converted to WAV format (resampled to 16 kHz mono if needed) using `AudioContext` and `OfflineAudioContext`.
4. Audio chunks are sent to the LLM either:
   - As base64-encoded audio content parts in `/v1/chat/completions` (if the model supports inline audio), or
   - Via `/v1/audio/transcriptions` to produce text transcripts with word-level timestamps, which are then included as text content.
5. A rolling buffer retains the most recent 30–60 seconds of audio for context.

### 4.3 Screen Capture

| Property        | Value                                      |
|-----------------|--------------------------------------------|
| Source          | Full screen or application window          |
| Format          | Same as video (MP4, sampled frames)        |
| Frame Sampling  | Configurable; default 0.5 FPS / 60 frames  |
| Dimensionality  | 3D (H × W × C)                             |

**Capture Pipeline:**
- Identical to video capture, but sources are filtered to `type: 'screen'` or `type: 'window'`.
- Screen captures can be triggered manually or on a schedule (e.g., every 2 seconds).
- Frames are downsampled to a max resolution of 1280×720 before encoding to reduce payload size.

### 4.4 Text

| Property        | Value                                      |
|-----------------|--------------------------------------------|
| Format          | UTF-8 String                               |
| Dimensionality  | 1D                                         |

**Sources:**
- User-typed chat messages via the app's text input UI.
- Transcribed audio from the LLM's transcription endpoint.
- OBS scene metadata (scene name, source list, stream status).
- System prompts and conversation history.

### 4.5 OBS Integration

| Property        | Value                                      |
|-----------------|--------------------------------------------|
| Protocol        | obs-websocket v5                           |
| Default Port    | 4455                                       |
| Data Retrieved  | Current scene name, active sources, stream/recording status, scene transition info |

**Pipeline:**
1. App connects to OBS via `obs-websocket` at `ws://localhost:4455` (configurable).
2. Subscribes to `CurrentProgramSceneChanged`, `StreamStateChanged`, `RecordStateChanged` events.
3. On each event (or on a polling interval of 2s), compiles a JSON summary:
   ```json
   {
     "current_scene": "Gaming Setup",
     "active_sources": ["Game Capture", "Webcam", "Alerts"],
     "stream_status": "live",
     "recording_status": "inactive"
   }
   ```
4. This summary is injected into the system prompt or as a tool-call context for the LLM.

---

## 5. Output Specifications

### 5.1 Text

| Property        | Value                                      |
|-----------------|--------------------------------------------|
| Format          | UTF-8 String                               |
| Dimensionality  | 1D                                         |
| Max Context     | 256k tokens                                |
| Language        | English only                               |

### 5.2 Supported Output Modes

| Mode                  | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| **Standard Text**     | Natural language response from the LLM.                                     |
| **JSON Output**       | Structured JSON response via `response_format: { "type": "json_object" }`.  |
| **Chain-of-Thought**  | Reasoning steps included in the response (via model-specific parameters).   |
| **Tool Calling**      | LLM returns structured tool call requests with function name and arguments. |
| **Word-Level Timestamps** | Transcription output includes per-word timing data.                     |

### 5.3 Tool Call Output Format

The LLM returns tool calls in OpenAI-compatible format:

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "trigger_vts_hotkey",
          "arguments": "{\"hotkey_id\": \"emote_happy\", \"intensity\": 0.8}"
        }
      }]
    }
  }]
}
```

---

## 6. LLM Backend Specification

### 6.1 Model

- **Model**: Nemotron Nano Omni v3
- **Deployment**: Runs on a separate NVIDIA GPU-accelerated machine
- **API Format**: OpenAI-compatible REST API
- **Port**: `8000`
- **Base URL**: `http://<llm-host>:8000/v1`

### 6.2 Endpoints

| Endpoint                     | Method | Description                                  |
|------------------------------|--------|----------------------------------------------|
| `/v1/chat/completions`       | POST   | Main multimodal chat endpoint                |
| `/v1/audio/transcriptions`   | POST   | Audio-to-text with word-level timestamps     |
| `/v1/models`                 | GET    | List available models                        |
| `/v1/health`                 | GET    | Health check                                 |

### 6.3 Chat Completions Request Format

```json
{
  "model": "nemotron-nano-omni-v3",
  "messages": [
    {
      "role": "system",
      "content": "You are a VTuber AI assistant. You observe the user via video, audio, and screen capture. You respond with text and tool calls to control the VTuber avatar via VTube Studio."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,<base64-encoded-frame>",
            "detail": "low"
          }
        },
        {
          "type": "input_audio",
          "input_audio": {
            "data": "data:audio/wav;base64,<base64-encoded-audio>",
            "format": "wav"
          }
        },
        {
          "type": "text",
          "text": "What do you think the user is feeling right now?"
        }
      ]
    }
  ],
  "max_tokens": 1024,
  "temperature": 0.7,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "trigger_vts_hotkey",
        "description": "Trigger a hotkey in VTube Studio to make the avatar perform an action or emote.",
        "parameters": {
          "type": "object",
          "properties": {
            "hotkey_id": {
              "type": "string",
              "description": "The ID of the hotkey to trigger (e.g., 'emote_happy', 'emote_sad', 'wave', 'dance')."
            },
            "intensity": {
              "type": "number",
              "description": "Intensity of the action from 0.0 to 1.0.",
              "minimum": 0.0,
              "maximum": 1.0
            },
            "reason": {
              "type": "string",
              "description": "Brief reason for triggering this action."
            }
          },
          "required": ["hotkey_id"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_obs_scene_info",
        "description": "Retrieve the current OBS scene information.",
        "parameters": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    }
  ],
  "tool_choice": "auto",
  "response_format": { "type": "text" },
  "stream": true
}
```

### 6.4 Context Window

- **Maximum context length**: 256k tokens
- **Token budgeting strategy**:
  - System prompt: ~500 tokens
  - Conversation history: rolling window of last 20 messages (~10k tokens)
  - Video frames: each frame ~150–300 tokens (depending on detail level); 128 frames = ~19k–38k tokens
  - Audio transcript: ~500 tokens per minute of speech
  - OBS metadata: ~200 tokens
  - Remaining budget available for response generation

### 6.5 Hardware Requirements (LLM Backend)

- **GPU**: NVIDIA GPU with at least 24 GB VRAM (RTX 4090 / A10 / A100 recommended)
- **CUDA**: CUDA 12.x with cuDNN 9.x
- **Framework**: vLLM, TGI, or NVIDIA NIM for serving
- **Memory**: 64 GB system RAM minimum
- **Storage**: NVMe SSD for model weights (100+ GB)

---

## 7. VTube Studio Integration

### 7.1 VTS Public API

- **Protocol**: JSON over TCP (primary) + UDP (for hotkeys)
- **Default Port**: `8001` (TCP), `8002` (UDP for hotkeys)
- **Authentication**: Token-based (request token via API, user approves in VTS UI)

### 7.2 Authentication Flow

1. App sends authentication request:
   ```json
   {
     "apiName": "Beaverhack2026",
     "apiVersion": "1.0",
     "requester": "Beaverhack2026 VTuber AI",
     "pluginName": "Beaverhack2026",
     "pluginDeveloper": "Beaverhack2026 Team",
     "pluginVersion": "1.0"
   }
   ```
2. VTS prompts user to approve the plugin.
3. App receives an authentication token.
4. All subsequent requests include the token:
   ```json
   {
     "messageType": "HotkeyTriggerRequest",
     "data": {
       "hotkeyID": "emote_happy",
       "pluginToken": "<auth-token>"
     }
   }
   ```

### 7.3 Hotkey Triggering

**Available Hotkeys (configured by user in VTS):**

| Hotkey ID         | Description                        |
|-------------------|------------------------------------|
| `emote_happy`     | Happy expression / smile           |
| `emote_sad`       | Sad expression                     |
| `emote_surprised` | Surprised / shocked expression     |
| `emote_angry`     | Angry expression                   |
| `emote_thinking`  | Thinking / pondering pose          |
| `emote_excited`   | Excited / energetic pose           |
| `wave`            | Wave hand                          |
| `dance`           | Dance animation                    |
| `nod`             | Nod head                           |
| `shake_head`      | Shake head                         |
| `point`           | Point gesture                    |
| `custom_1`–`custom_10` | User-defined custom hotkeys  |

**Trigger Request Format:**

```json
{
  "messageType": "HotkeyTriggerRequest",
  "data": {
    "hotkeyID": "emote_happy",
    "itemInstanceID": "",
    "pluginToken": "<auth-token>"
  }
}
```

### 7.4 Future: WebSocket Parameter Control

In a future iteration, the app will connect directly to VTS's WebSocket interface for fine-grained control:

- **Face parameter manipulation**: Eye openness, mouth shape, eyebrow position, etc.
- **Physics control**: Hair sway, clothing physics intensity
- **Position/rotation**: Avatar position, rotation, scale adjustments
- **Model switching**: Load/unload different avatar models

**WebSocket Message Format:**

```json
{
  "apiName": "Beaverhack2026",
  "apiVersion": "1.0",
  "requestID": "req_001",
  "messageType": "InjectParameterDataRequest",
  "data": {
    "faceFound": true,
    "parameterValues": [
      { "id": "FaceLeft", "value": 0.5, "weight": 0.8 },
      { "id": "MouthOpen", "value": 0.3, "weight": 0.6 }
    ],
    "pluginToken": "<auth-token>"
  }
}
```

---

## 8. Application Architecture (Electron + Next.js)

### 8.1 Process Structure

```
┌─────────────────────────────────────────────────────┐
│                   Main Process                       │
│  • Electron lifecycle management                    │
│  • Native module access (desktopCapturer, etc.)     │
│  • OBS WebSocket connection manager                 │
│  • VTube Studio API client                          │
│  • LLM API client (HTTP to port 8000)               │
│  • IPC handlers for renderer communication          │
│  • Audio/Video capture orchestration                │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (invoke/handle)
┌──────────────────────▼──────────────────────────────┐
│                 Renderer Process                     │
│  • Next.js App Router (React 19)                    │
│  • UI components (settings, preview, chat, logs)    │
│  • State management (Zustand)                       │
│  • Media preview (video, audio waveform)            │
│  • Real-time log viewer                             │
└─────────────────────────────────────────────────────┘
```

### 8.2 Directory Structure

```
beaverhack2026/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── SPEC.md
│
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App entry point
│   │   ├── ipc/                       # IPC handlers
│   │   │   ├── capture.ts             # Video/audio/screen capture IPC
│   │   │   ├── vts.ts                 # VTube Studio IPC
│   │   │   ├── obs.ts                 # OBS WebSocket IPC
│   │   │   └── llm.ts                 # LLM API IPC
│   │   ├── services/
│   │   │   ├── capture.service.ts     # Media capture orchestration
│   │   │   ├── vts.service.ts         # VTube Studio API client
│   │   │   ├── obs.service.ts         # OBS WebSocket client
│   │   │   ├── llm.service.ts         # LLM API client
│   │   │   ├── pipeline.service.ts    # Input → LLM → Tool call pipeline
│   │   │   └── token-budget.service.ts # Context window management
│   │   └── utils/
│   │       ├── audio.ts               # Audio processing utilities
│   │       ├── video.ts               # Video frame sampling utilities
│   │       └── base64.ts              # Base64 encoding utilities
│   │
│   ├── renderer/                      # Next.js renderer process
│   │   ├── app/                       # App Router pages
│   │   │   ├── layout.tsx             # Root layout
│   │   │   ├── page.tsx               # Main dashboard
│   │   │   ├── settings/              # Settings page
│   │   │   │   └── page.tsx
│   │   │   ├── logs/                  # Log viewer page
│   │   │   │   └── page.tsx
│   │   │   └── api/                   # API routes (if needed)
│   │   │
│   │   ├── components/                # React components
│   │   │   ├── VideoPreview.tsx       # Video/screen capture preview
│   │   │   ├── AudioWaveform.tsx      # Audio waveform visualization
│   │   │   ├── ChatPanel.tsx          # Chat/message display
│   │   │   ├── LogViewer.tsx          # Real-time log display
│   │   │   ├── SettingsForm.tsx       # Settings form
│   │   │   ├── StatusIndicator.tsx    # Connection status indicators
│   │   │   └── HotkeyConfig.tsx       # Hotkey configuration UI
│   │   │
│   │   ├── stores/                    # Zustand stores
│   │   │   ├── capture.store.ts       # Capture state
│   │   │   ├── vts.store.ts           # VTube Studio state
│   │   │   ├── obs.store.ts           # OBS state
│   │   │   ├── llm.store.ts           # LLM conversation state
│   │   │   └── settings.store.ts      # App settings
│   │   │
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── useCapture.ts          # Media capture hook
│   │   │   ├── useVTS.ts              # VTube Studio hook
│   │   │   ├── useOBS.ts              # OBS hook
│   │   │   └── useLLM.ts              # LLM interaction hook
│   │   │
│   │   └── styles/                    # Global styles
│   │       └── globals.css
│   │
│   └── shared/                        # Shared types and utilities
│       ├── types/
│       │   ├── capture.types.ts
│       │   ├── vts.types.ts
│       │   ├── obs.types.ts
│       │   ├── llm.types.ts
│       │   └── pipeline.types.ts
│       └── constants.ts
│
├── public/                            # Static assets
│   └── icons/
│
└── resources/                         # Electron build resources
    └── icon.ico
```

---

## 9. Input Pipeline

### 9.1 Pipeline Overview

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Video   │───▶│          │    │          │    │          │
│  Frames  │    │          │    │          │    │          │
├──────────┤    │  Frame   │    │  Payload │    │   LLM    │
│  Audio   │───▶│  Buffer  │───▶│  Builder │───▶│  Request │
│  Chunks  │    │  &       │    │  (OpenAI │    │  (Port   │
├──────────┤    │  Sampler │    │  Format) │    │   8000)  │
│  Screen  │───▶│          │    │          │    │          │
│  Frames  │    │          │    │          │    │          │
├──────────┤    └──────────┘    └──────────┘    └──────────┘
│  OBS     │───▶│  Context │
│  Metadata│    │  Injector│
├──────────┤    └──────────┘
│  Text    │───▶│
│  Input   │
└──────────┘
```

### 9.2 Frame Sampling Strategy

| Input Type  | Resolution  | FPS  | Max Frames | Encoding  |
|-------------|-------------|------|------------|-----------|
| Video 1080p | 1920×1080   | 1    | 128        | JPEG 80%  |
| Video 720p  | 1280×720    | 2    | 256        | JPEG 80%  |
| Screen      | 1280×720    | 0.5  | 60         | JPEG 70%  |

**Implementation:**
- Frames are stored in a circular buffer (`FrameBuffer` class).
- When the buffer is full, oldest frames are evicted.
- On request trigger, the buffer is drained and frames are encoded as base64 data URIs.
- Frame downsampling is applied if resolution exceeds model input limits.

### 9.3 Audio Processing

1. **Capture**: `MediaRecorder` captures audio in 1-second chunks.
2. **Resampling**: `AudioContext` resamples to 16 kHz mono.
3. **Encoding**: Chunks are encoded as WAV (PCM 16-bit).
4. **Buffering**: A rolling 60-second buffer is maintained.
5. **Transcription**: Audio is sent to `/v1/audio/transcriptions` for text + word-level timestamps.
6. **Integration**: Transcript text is appended to the conversation as a user message.

### 9.4 Context Assembly

Each LLM request assembles the following context:

```json
{
  "system_prompt": "...",
  "conversation_history": [...],
  "current_frame_batch": [image_url, ...],
  "audio_transcript": "transcribed text with timestamps",
  "obs_scene_info": { "current_scene": "...", ... },
  "user_text_input": "optional typed message"
}
```

---

## 10. Tool Call Dispatcher

### 10.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  LLM Response                        │
│  { tool_calls: [...] }                               │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              Tool Call Router                        │
│  • Parses tool_calls from LLM response              │
│  • Maps function names to handlers                  │
│  • Executes handlers sequentially or in parallel    │
│  • Returns results to LLM (if needed)               │
└──────┬──────────────────────────────┬────────────────┘
       ▼                              ▼
┌──────────────────┐    ┌──────────────────────────────┐
│  VTS Hotkey      │    │  OBS Scene Info              │
│  Handler         │    │  Handler                     │
│  • trigger_vts_  │    │  • get_obs_scene_info        │
│    hotkey        │    │  • get_obs_source_list       │
│  • set_vts_      │    │  • get_obs_stream_status     │
│    parameter     │    │                              │
│  (future)        │    │                              │
└──────────────────┘    └──────────────────────────────┘
```

### 10.2 Available Tools

| Tool Name              | Description                                  | Parameters                          |
|------------------------|----------------------------------------------|-------------------------------------|
| `trigger_vts_hotkey`   | Trigger a VTube Studio hotkey                | `hotkey_id`, `intensity`, `reason`  |
| `get_obs_scene_info`   | Get current OBS scene information            | (none)                              |
| `get_obs_source_list`  | Get list of sources in current scene         | `scene_name` (optional)             |
| `get_obs_stream_status`| Get stream/recording status                  | (none)                              |
| `send_chat_message`    | Send a text message to the user              | `message`, `display_duration`       |
| `log_event`            | Log an event to the application log          | `level`, `message`, `metadata`      |

### 10.3 Tool Call Execution Flow

1. LLM returns a response with `tool_calls`.
2. `ToolCallRouter` parses the response and identifies each tool call.
3. For each tool call:
   a. Validate parameters against the tool's schema.
   b. Execute the corresponding handler.
   c. Capture the result (success/failure + output).
4. Results are optionally sent back to the LLM as `tool` role messages for follow-up.
5. Results are logged and displayed in the UI.

---

## 11. Electron Main Process

### 11.1 Entry Point (`src/main/index.ts`)

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { registerCaptureHandlers } from './ipc/capture';
import { registerVTSHandlers } from './ipc/vts';
import { registerOBSHandlers } from './ipc/obs';
import { registerLLMHandlers } from './ipc/llm';
import { CaptureService } from './services/capture.service';
import { VTSService } from './services/vts.service';
import { OBSService } from './services/obs.service';
import { LLMService } from './services/llm.service';
import { PipelineService } from './services/pipeline.service';

let mainWindow: BrowserWindow;
let captureService: CaptureService;
let vtsService: VTSService;
let obsService: OBSService;
let llmService: LLMService;
let pipelineService: PipelineService;

app.whenReady().then(async () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Initialize services
  captureService = new CaptureService();
  vtsService = new VTSService();
  obsService = new OBSService();
  llmService = new LLMService({ baseUrl: 'http://localhost:8000/v1' });
  pipelineService = new PipelineService({
    captureService,
    vtsService,
    obsService,
    llmService,
  });

  // Register IPC handlers
  registerCaptureHandlers(ipcMain, captureService);
  registerVTSHandlers(ipcMain, vtsService);
  registerOBSHandlers(ipcMain, obsService);
  registerLLMHandlers(ipcMain, llmService);

  // Load Next.js dev server or built app
  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:3000');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/out/index.html'));
  }
});
```

### 11.2 IPC Handlers

Each IPC module registers `ipcMain.handle` and `ipcMain.on` listeners:

- **`capture.ts`**: `start-video-capture`, `stop-video-capture`, `start-audio-capture`, `stop-audio-capture`, `start-screen-capture`, `stop-screen-capture`, `get-capture-sources`
- **`vts.ts`**: `vts-connect`, `vts-disconnect`, `vts-trigger-hotkey`, `vts-get-hotkeys`, `vts-authenticate`
- **`obs.ts`**: `obs-connect`, `obs-disconnect`, `obs-get-scene-info`, `obs-get-sources`, `obs-get-stream-status`
- **`llm.ts`**: `llm-send-request`, `llm-transcribe-audio`, `llm-cancel-request`

### 11.3 Preload Script

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  capture: {
    startVideo: (sourceId: string) => ipcRenderer.invoke('start-video-capture', sourceId),
    stopVideo: () => ipcRenderer.invoke('stop-video-capture'),
    startAudio: () => ipcRenderer.invoke('start-audio-capture'),
    stopAudio: () => ipcRenderer.invoke('stop-audio-capture'),
    startScreen: (sourceId: string) => ipcRenderer.invoke('start-screen-capture', sourceId),
    stopScreen: () => ipcRenderer.invoke('stop-screen-capture'),
    getSources: () => ipcRenderer.invoke('get-capture-sources'),
  },
  vts: {
    connect: () => ipcRenderer.invoke('vts-connect'),
    disconnect: () => ipcRenderer.invoke('vts-disconnect'),
    triggerHotkey: (hotkeyId: string, intensity?: number) =>
      ipcRenderer.invoke('vts-trigger-hotkey', hotkeyId, intensity),
    getHotkeys: () => ipcRenderer.invoke('vts-get-hotkeys'),
    authenticate: () => ipcRenderer.invoke('vts-authenticate'),
  },
  obs: {
    connect: (host: string, port: number, password: string) =>
      ipcRenderer.invoke('obs-connect', host, port, password),
    disconnect: () => ipcRenderer.invoke('obs-disconnect'),
    getSceneInfo: () => ipcRenderer.invoke('obs-get-scene-info'),
    getSources: (sceneName?: string) => ipcRenderer.invoke('obs-get-sources', sceneName),
    getStreamStatus: () => ipcRenderer.invoke('obs-get-stream-status'),
  },
  llm: {
    sendRequest: (payload: any) => ipcRenderer.invoke('llm-send-request', payload),
    transcribeAudio: (audioData: string) => ipcRenderer.invoke('llm-transcribe-audio', audioData),
    cancelRequest: (requestId: string) => ipcRenderer.invoke('llm-cancel-request', requestId),
  },
});
```

---

## 12. Services

### 12.1 CaptureService (`src/main/services/capture.service.ts`)

Manages all media capture operations:

```typescript
export class CaptureService {
  private videoStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private frameBuffer: FrameBuffer;
  private audioBuffer: AudioBuffer;

  async getSources(): Promise<CaptureSource[]> { ... }
  async startVideo(sourceId: string, config: VideoConfig): Promise<void> { ... }
  async stopVideo(): Promise<void> { ... }
  async startAudio(config: AudioConfig): Promise<void> { ... }
  async stopAudio(): Promise<void> { ... }
  async startScreen(sourceId: string, config: ScreenConfig): Promise<void> { ... }
  async stopScreen(): Promise<void> { ... }
  getRecentFrames(maxFrames: number): Frame[] { ... }
  getRecentAudio(durationSeconds: number): AudioChunk { ... }
}
```

### 12.2 VTSService (`src/main/services/vts.service.ts`)

Manages VTube Studio API communication:

```typescript
export class VTSService {
  private tcpClient: net.Socket | null = null;
  private udpClient: dgram.Socket | null = null;
  private authToken: string | null = null;
  private connected = false;

  async connect(host: string, tcpPort: number, udpPort: number): Promise<void> { ... }
  async disconnect(): Promise<void> { ... }
  async authenticate(): Promise<string> { ... }
  async triggerHotkey(hotkeyId: string, intensity?: number): Promise<HotkeyResult> { ... }
  async getHotkeys(): Promise<Hotkey[]> { ... }
  async injectParameters(params: ParameterValue[]): Promise<void> { ... } // Future
}
```

### 12.3 OBSService (`src/main/services/obs.service.ts`)

Manages OBS WebSocket connection:

```typescript
export class OBSService {
  private ws: WebSocket | null = null;
  private connected = false;

  async connect(host: string, port: number, password: string): Promise<void> { ... }
  async disconnect(): Promise<void> { ... }
  async getSceneInfo(): Promise<SceneInfo> { ... }
  async getSources(sceneName?: string): Promise<SourceInfo[]> { ... }
  async getStreamStatus(): Promise<StreamStatus> { ... }
  onSceneChanged(callback: (info: SceneInfo) => void): void { ... }
  onStreamStatusChanged(callback: (status: StreamStatus) => void): void { ... }
}
```

### 12.4 LLMService (`src/main/services/llm.service.ts`)

Manages communication with the Nemotron backend:

```typescript
export class LLMService {
  private baseUrl: string;
  private activeRequests: Map<string, AbortController>;

  constructor(config: { baseUrl: string }) { ... }

  async sendChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> { ... }
  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: ChatCompletionChunk) => void
  ): Promise<void> { ... }
  async transcribeAudio(audioData: string): Promise<TranscriptionResponse> { ... }
  async cancelRequest(requestId: string): Promise<void> { ... }
}
```

### 12.5 PipelineService (`src/main/services/pipeline.service.ts`)

Orchestrates the full input → LLM → tool call pipeline:

```typescript
export class PipelineService {
  private captureService: CaptureService;
  private vtsService: VTSService;
  private obsService: OBSService;
  private llmService: LLMService;
  private conversationHistory: Message[];
  private tokenBudget: TokenBudgetService;

  async triggerPipeline(userText?: string): Promise<PipelineResult> {
    // 1. Gather recent frames from capture service
    // 2. Gather recent audio and transcribe
    // 3. Get current OBS scene info
    // 4. Assemble OpenAI-format payload
    // 5. Send to LLM
    // 6. Parse response for tool calls
    // 7. Execute tool calls
    // 8. Return result
  }

  async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> { ... }
}
```

---

## 13. State Management (Zustand Stores)

### 13.1 Capture Store

```typescript
interface CaptureState {
  videoSource: CaptureSource | null;
  audioSource: string | null;
  screenSource: CaptureSource | null;
  isCapturingVideo: boolean;
  isCapturingAudio: boolean;
  isCapturingScreen: boolean;
  sources: CaptureSource[];
  startVideo: (sourceId: string) => Promise<void>;
  stopVideo: () => Promise<void>;
  startAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  startScreen: (sourceId: string) => Promise<void>;
  stopScreen: () => Promise<void>;
  loadSources: () => Promise<void>;
}
```

### 13.2 VTS Store

```typescript
interface VTSState {
  isConnected: boolean;
  isAuthenticated: boolean;
  hotkeys: Hotkey[];
  lastTriggeredHotkey: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  authenticate: () => Promise<void>;
  triggerHotkey: (hotkeyId: string, intensity?: number) => Promise<void>;
  loadHotkeys: () => Promise<void>;
}
```

### 13.3 OBS Store

```typescript
interface OBSState {
  isConnected: boolean;
  currentScene: SceneInfo | null;
  streamStatus: StreamStatus | null;
  connect: (host: string, port: number, password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshSceneInfo: () => Promise<void>;
  refreshStreamStatus: () => Promise<void>;
}
```

### 13.4 LLM Store

```typescript
interface LLMState {
  isProcessing: boolean;
  conversationHistory: Message[];
  currentResponse: string | null;
  toolCallResults: ToolResult[];
  sendRequest: (userText?: string) => Promise<void>;
  cancelRequest: () => Promise<void>;
  clearHistory: () => void;
}
```

### 13.5 Settings Store

```typescript
interface SettingsState {
  llmBaseUrl: string;
  vtsHost: string;
  vtsTcpPort: number;
  vtsUdpPort: number;
  obsHost: string;
  obsPort: number;
  obsPassword: string;
  videoSamplingFps: number;
  audioSampleRate: number;
  maxContextTokens: number;
  temperature: number;
  maxTokens: number;
  updateSettings: (settings: Partial<SettingsState>) => void;
}
```

---

## 14. UI Components

### 14.1 Main Dashboard (`src/renderer/app/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Beaverhack2026 — VTuber AI Integration                            │
├──────────────────┬──────────────────────────┬───────────────────────┤
│                  │                          │                       │
│  Capture Panel   │   Chat / Response Panel  │   Status Panel        │
│                  │                          │                       │
│  [Video Preview] │   LLM Response Text      │   [●] VTS Connected   │
│                  │                          │   [●] OBS Connected   │
│  [Audio Meter]   │   Tool Call Results      │   [○] LLM Ready       │
│                  │                          │                       │
│  [Screen Preview]│   [Trigger Response]     │   Current Scene:      │
│                  │   [Cancel]               │   "Gaming Setup"      │
│                  │                          │                       │
│  Source Select:  │   Conversation History   │   Stream: ● Live      │
│  [Dropdown]      │   (scrollable)           │   Recording: ○ Off    │
│                  │                          │                       │
├──────────────────┴──────────────────────────┴───────────────────────┤
│  [Settings]  [Logs]  [Hotkey Config]  [Model: nemotron-nano-omni-v3]│
└─────────────────────────────────────────────────────────────────────┘
```

### 14.2 Settings Page

- **LLM Backend**: Base URL, model name, temperature, max tokens
- **VTube Studio**: Host, TCP port, UDP port, auth token
- **OBS**: Host, port, password
- **Capture**: Video FPS, audio sample rate, screen capture interval
- **Context**: Max context tokens, conversation history length

### 14.3 Log Viewer

- Real-time log stream from the main process
- Filterable by level (info, warn, error, debug)
- Filterable by source (capture, vts, obs, llm, pipeline)
- Searchable text

### 14.4 Hotkey Configuration

- List of available VTS hotkeys (fetched from VTS API)
- Map hotkeys to AI-triggered actions
- Test hotkey triggers manually
- Add custom hotkey mappings

---

## 15. Configuration

### 15.1 Default Configuration

```json
{
  "llm": {
    "baseUrl": "http://localhost:8000/v1",
    "model": "nemotron-nano-omni-v3",
    "temperature": 0.7,
    "maxTokens": 1024,
    "maxContextTokens": 262144
  },
  "vts": {
    "host": "localhost",
    "tcpPort": 8001,
    "udpPort": 8002,
    "authToken": null
  },
  "obs": {
    "host": "localhost",
    "port": 4455,
    "password": ""
  },
  "capture": {
    "video": {
      "fps": 1,
      "maxFrames": 128,
      "resolution": "1920x1080",
      "jpegQuality": 80
    },
    "audio": {
      "sampleRate": 16000,
      "channels": 1,
      "bufferDurationSeconds": 60
    },
    "screen": {
      "fps": 0.5,
      "maxFrames": 60,
      "resolution": "1280x720",
      "jpegQuality": 70
    }
  },
  "pipeline": {
    "autoTriggerIntervalMs": 5000,
    "autoTriggerEnabled": false,
    "includeSystemPrompt": true,
    "includeConversationHistory": true,
    "maxHistoryMessages": 20
  }
}
```

### 15.2 Environment Variables

| Variable              | Description                        | Default              |
|-----------------------|------------------------------------|----------------------|
| `LLM_BASE_URL`        | LLM API base URL                   | `http://localhost:8000/v1` |
| `VTS_HOST`            | VTube Studio host                  | `localhost`          |
| `VTS_TCP_PORT`        | VTube Studio TCP port              | `8001`               |
| `VTS_UDP_PORT`        | VTube Studio UDP port              | `8002`               |
| `OBS_HOST`            | OBS WebSocket host                 | `localhost`          |
| `OBS_PORT`            | OBS WebSocket port                 | `4455`               |
| `OBS_PASSWORD`        | OBS WebSocket password             | (empty)              |
| `NODE_ENV`            | Node environment                   | `development`        |

---

## 16. System Prompt Template

```
You are Beaverhack2026, an AI VTuber assistant. You observe the user through video, audio, and screen capture feeds. Your role is to:

1. Understand the user's emotional state, actions, and context from the multimodal inputs.
2. Respond with appropriate text responses.
3. Trigger VTube Studio hotkeys to make the avatar react appropriately (emotes, gestures, expressions).
4. Monitor OBS scene information to understand the streaming context.

Guidelines:
- Be empathetic and engaging. Match your responses to the user's emotional state.
- Use tool calls to trigger avatar reactions that complement your text responses.
- Consider the current OBS scene when deciding how to react (e.g., be more energetic during a "Gaming" scene).
- Keep responses concise and natural.
- Only trigger hotkeys when it makes sense contextually. Don't over-trigger.

Available hotkeys: {hotkey_list}
Current OBS scene: {scene_info}
```

---

## 17. Error Handling

### 17.1 Connection Errors

| Service          | Error                          | Recovery Strategy                           |
|------------------|--------------------------------|---------------------------------------------|
| LLM Backend      | Connection refused / timeout   | Retry with exponential backoff (max 3)      |
| VTube Studio     | Connection refused             | Prompt user to open VTS and enable API      |
| VTube Studio     | Auth token rejected            | Prompt user to re-authenticate              |
| OBS              | WebSocket connection failed    | Prompt user to check obs-websocket settings |
| OBS              | Authentication failed          | Prompt user to verify password              |

### 17.2 Capture Errors

| Error                          | Recovery Strategy                           |
|--------------------------------|---------------------------------------------|
| No video source available      | Prompt user to select a source              |
| No audio source available      | Prompt user to check microphone permissions |
| Screen capture permission denied | Prompt user to grant screen recording permission (macOS) |
| Frame buffer overflow          | Drop oldest frames, log warning             |
| Audio buffer overflow          | Drop oldest chunks, log warning             |

### 17.3 LLM Errors

| Error                          | Recovery Strategy                           |
|--------------------------------|---------------------------------------------|
| Context window exceeded        | Truncate conversation history, reduce frames |
| Rate limit exceeded            | Queue request, retry after delay            |
| Invalid response format        | Log error, retry with stricter format hints |
| Model unavailable              | Notify user, disable pipeline               |

---

## 18. Security Considerations

1. **Authentication Tokens**: VTS auth tokens and OBS passwords are stored encrypted in the Electron secure store (`electron-store` with encryption).
2. **Network Communication**: All local network communication (LLM, VTS, OBS) uses localhost by default. Remote connections should use TLS.
3. **Input Sanitization**: All user inputs and LLM responses are sanitized before display or execution.
4. **Tool Call Validation**: Tool call parameters are validated against schemas before execution.
5. **Permissions**: The app requests only necessary permissions (microphone, screen recording, camera).

---

## 19. Performance Considerations

1. **Frame Encoding**: JPEG encoding is offloaded to a worker thread to avoid blocking the main process.
2. **Audio Resampling**: Uses `OfflineAudioContext` for efficient resampling.
3. **Streaming Responses**: LLM responses are streamed to reduce perceived latency.
4. **Token Budgeting**: Context window is managed to stay within model limits while maximizing useful context.
5. **Debounced Triggers**: Pipeline triggers are debounced to avoid overwhelming the LLM.
6. **Connection Pooling**: HTTP connections to the LLM backend are reused via keep-alive.

---

## 20. Testing Strategy

### 20.1 Unit Tests

- Frame buffer management
- Audio resampling and encoding
- Payload building (OpenAI format)
- Tool call parsing and validation
- Token budgeting logic

### 20.2 Integration Tests

- VTS API communication (mocked VTS server)
- OBS WebSocket communication (mocked OBS server)
- LLM API communication (mocked LLM server)
- Full pipeline: capture → payload → LLM → tool call → VTS

### 20.3 E2E Tests

- App launch and settings configuration
- Media capture start/stop
- Hotkey trigger flow
- OBS scene change detection
- Error recovery scenarios

### 20.4 Test Tools

- **Unit/Integration**: Vitest + Testing Library
- **E2E**: Playwright (Electron support)
- **Mocking**: MSW (Mock Service Worker) for HTTP, `ws-mock` for WebSocket

---

## 21. Build and Deployment

### 21.1 Development

```bash
# Install dependencies
npm install

# Start Next.js dev server
npm run dev

# Start Electron (in separate terminal or via concurrently)
npm run electron:dev
```

### 21.2 Production Build

```bash
# Build Next.js app
npm run build

# Build Electron app
npm run electron:build
```

### 21.3 Platform Targets

- **Windows**: x64, NSIS installer
- **macOS**: x64 + arm64 (universal), DMG
- **Linux**: x64, AppImage + deb

---

## 22. Future Enhancements

1. **WebSocket Parameter Control**: Direct face parameter injection into VTS for fine-grained avatar control.
2. **Text-to-Speech**: Integrate TTS for voice output from the VTuber avatar.
3. **Lip Sync**: Real-time lip sync from TTS audio output.
4. **Multi-Model Support**: Support switching between different LLM backends.
5. **Cloud Deployment**: Option to run the Electron app as a web app with cloud-hosted LLM.
6. **Plugin System**: Extensible plugin architecture for custom tools and integrations.
7. **Analytics**: Usage analytics and performance monitoring.
8. **Custom Avatars**: Support for loading custom avatar models.
9. **Multi-Language**: Expand beyond English to other languages.
10. **Emotion Detection**: Dedicated emotion detection model for more accurate avatar reactions.

---

## 23. Glossary

| Term              | Definition                                                                 |
|-------------------|---------------------------------------------------------------------------|
| VTS               | VTube Studio — the avatar animation software                              |
| VTS API           | VTube Studio Public API for plugin integration                            |
| OBS               | Open Broadcaster Software — streaming/recording software                  |
| obs-websocket     | OBS plugin that exposes a WebSocket API                                   |
| LLM               | Large Language Model                                                      |
| Nemotron          | NVIDIA's family of multimodal AI models                                   |
| CoT               | Chain-of-Thought — reasoning output from the LLM                          |
| IPC               | Inter-Process Communication (Electron main ↔ renderer)                    |
| Token             | Unit of text used by the LLM for processing                               |
| Context Window    | Maximum number of tokens the LLM can process in a single request          |
| Hotkey            | A triggerable action in VTube Studio mapped to an avatar animation        |
| Frame Buffer      | Circular buffer storing recent video/screen frames                        |
| Audio Buffer      | Circular buffer storing recent audio chunks                               |
| Tool Call         | Structured function call returned by the LLM                              |
| Pipeline          | The full flow: capture → assemble → LLM → parse → execute tool calls     |
