# Beaverhack2026 — VTuber AI Background Agent Specification

## 1. Overview

Beaverhack2026 is a background VTuber automation and stream-direction agent.

The system observes local streamer context through Electron-managed inputs such as microphone audio, camera/video frames, screen capture, OBS state, VTube Studio state, and optional user text. These inputs are sent to a headless Next.js processor API, which prepares multimodal requests for the LLM backend and returns structured action plans. Electron then executes those action plans locally through OBS WebSocket, VTube Studio WebSocket, local overlays, logs, and future audio/TTS outputs.

This project is not primarily a web frontend. Next.js is used as a server-side processor and API layer only. The desktop interface is provided by Electron, and it may run mostly in the background with a tray icon, setup window, status panel, and logs.

Primary goal:

Electron captures local context -> Next.js processes and decides -> Electron executes local actions.

---

## 2. System Architecture

~~~text
┌─────────────────────────────────────────────────────────────────────┐
│                         Local Desktop Machine                       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Electron Background Agent                  │  │
│  │                                                               │  │
│  │  Responsibilities:                                            │  │
│  │  • Capture microphone / camera / screen / window frames       │  │
│  │  • Read OBS scene/source/stream state                         │  │
│  │  • Read VTube Studio hotkeys/model state                      │  │
│  │  • Run tray/status/settings UI                                │  │
│  │  • Host optional loopback local API                           │  │
│  │  • Execute approved local actions                             │  │
│  │                                                               │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐ │  │
│  │  │ Input Agent │──▶│ Observation │──▶│ Next.js Processor   │ │  │
│  │  │             │   │ Envelope    │   │ Client              │ │  │
│  │  └─────────────┘   └─────────────┘   └──────────┬──────────┘ │  │
│  │                                                 │            │  │
│  │                                                 ▼            │  │
│  │                                      ┌─────────────────────┐ │  │
│  │                                      │ Action Executor     │ │  │
│  │                                      │ • VTS hotkeys       │ │  │
│  │                                      │ • OBS controls      │ │  │
│  │                                      │ • overlays/logs     │ │  │
│  │                                      │ • future TTS        │ │  │
│  │                                      └─────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│             │                                      ▲                 │
│             │ HTTP/WebSocket                       │ local execution │
│             ▼                                      │                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Headless Next.js Processor API                   │  │
│  │                                                               │  │
│  │  Responsibilities:                                            │  │
│  │  • Receive normalized observation envelopes                   │  │
│  │  • Build multimodal OpenAI-compatible LLM payloads            │  │
│  │  • Apply policy, cooldown, memory, and action filtering       │  │
│  │  • Call LLM backend                                           │  │
│  │  • Parse LLM response/tool calls                              │  │
│  │  • Return structured ActionPlan JSON to Electron              │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │ HTTP
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LLM Backend Machine                         │
│                                                                     │
│  OpenAI-compatible API                                              │
│  • /v1/chat/completions                                             │
│  • /v1/audio/transcriptions optional                                │
│  • /v1/models                                                       │
│  • /v1/health                                                       │
│                                                                     │
│  Model: Nemotron Nano Omni v3 or compatible multimodal backend       │
└─────────────────────────────────────────────────────────────────────┘
~~~

---

## 3. Responsibility Split

| Component | Runs Where | Owns | Does Not Own |
|---|---:|---|---|
| Electron Main Process | Local desktop | App lifecycle, tray, settings, local services, OBS/VTS clients, local action execution | LLM reasoning |
| Electron Renderer / Hidden Capture Windows | Local desktop | Media capture, permission prompts, previews, setup/status UI | Long-term processing logic |
| Electron Local API | Local desktop, loopback only | Optional local control/status endpoint for Next.js or plugins | Public internet API |
| Next.js Processor API | Local or server machine | API routes, payload building, model request orchestration, tool-call validation, action-plan generation | Direct desktop capture, direct OBS/VTS execution |
| LLM Backend | GPU machine | Model inference | Local side effects |
| OBS | Local desktop | Streaming/recording state and sources | AI reasoning |
| VTube Studio | Local desktop | Avatar model, hotkeys, parameters | AI reasoning |

Important rule:

The LLM and Next.js processor may recommend actions, but Electron is the only component allowed to execute local side effects.

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Desktop Agent | Electron 33+ |
| Desktop UI | Electron renderer, React optional |
| Background Operation | Electron tray app + auto-start support |
| Local IPC | Electron IPC main <-> renderer |
| Optional Local API | Fastify or Express inside Electron main process |
| Processor API | Next.js 15 Route Handlers, API-only |
| Processor Runtime | Node.js 20+ or 24 LTS |
| Video/Screen Source Discovery | Electron `desktopCapturer` |
| Video/Screen Capture | `navigator.mediaDevices.getUserMedia` in renderer/capture window |
| Audio Capture | `navigator.mediaDevices.getUserMedia` |
| OBS Integration | obs-websocket v5, default port 4455 |
| VTube Studio Integration | VTube Studio Public API WebSocket, default port 8001 |
| LLM Backend | OpenAI-compatible REST API, default port 8000 |
| Storage | SQLite or JSON config for local app state; optional Postgres for shared processor state |
| Build | electron-builder for Electron; Next.js standalone/server build for processor |
| Validation | Zod schemas shared between Electron and Next.js |

---

## 5. Corrected Runtime Flow

### 5.1 Normal Automatic Background Flow

~~~text
1. Electron starts in the background.
2. Electron connects to OBS and VTube Studio.
3. Electron starts configured capture streams.
4. Electron samples local inputs into rolling buffers.
5. Electron periodically creates an ObservationEnvelope.
6. Electron sends the envelope to the Next.js processor.
7. Next.js builds an LLM request.
8. Next.js calls the LLM backend.
9. Next.js validates the LLM response and creates an ActionPlan.
10. Electron receives the ActionPlan.
11. Electron applies local safety checks, cooldowns, and allowlists.
12. Electron executes local actions through OBS/VTS/local overlay APIs.
13. Electron logs results and optionally sends execution results back to Next.js.
~~~

### 5.2 Recommended Direction of Control

Recommended:

~~~text
Electron -> Next.js Processor -> LLM Backend
Electron <- ActionPlan <- Next.js Processor
Electron executes actions locally
~~~

Avoid as the default:

~~~text
Next.js Processor -> Electron local API -> OBS/VTS
~~~

Reason:

If Next.js runs on another machine or in the cloud, it usually cannot safely or reliably call a desktop-local Electron API. Electron should initiate outbound requests and execute returned plans.

### 5.3 Optional Electron Local API

Electron may still expose a loopback-only local API for debugging, plugins, or same-machine processors.

Allowed bindings:

~~~text
127.0.0.1 only
localhost only
~~~

Required security:

~~~text
Bearer token required
No public network binding by default
No unauthenticated local action execution
Action schema validation
Action allowlist
Cooldowns and rate limits
~~~

---

## 6. Main Data Contracts

### 6.1 ObservationEnvelope

Electron sends this to the Next.js processor.

~~~typescript
export type ObservationEnvelope = {
  schemaVersion: "2026-05-02";
  sessionId: string;
  tickId: string;
  createdAt: string;

  source: {
    app: "electron-agent";
    hostId: string;
    userMode: "background" | "setup" | "manual";
  };

  capture: {
    cameraFrames: CapturedFrame[];
    screenFrames: CapturedFrame[];
    audio: CapturedAudioChunk[];
    transcript?: TranscriptSegment[];
    userText?: string;
  };

  obs: {
    connected: boolean;
    currentScene?: string;
    activeSources?: string[];
    streamStatus?: "offline" | "starting" | "live" | "stopping";
    recordingStatus?: "inactive" | "starting" | "recording" | "stopping";
    transitionName?: string;
  };

  vts: {
    connected: boolean;
    authenticated: boolean;
    currentModelName?: string;
    availableHotkeys?: VtsHotkey[];
    lastTriggeredHotkeyId?: string;
  };

  runtime: {
    batterySaver?: boolean;
    cpuLoad?: number;
    memoryUsedMb?: number;
    foregroundApp?: string;
  };

  policy: {
    autonomyLevel: "suggest_only" | "auto_safe" | "auto_full";
    allowedTools: string[];
    blockedTools: string[];
    maxActionsPerTick: number;
  };
};

export type CapturedFrame = {
  id: string;
  kind: "camera" | "screen" | "window";
  capturedAt: string;
  width: number;
  height: number;
  mimeType: "image/jpeg" | "image/png";
  dataUrl: string;
  detail: "low" | "high";
};

export type CapturedAudioChunk = {
  id: string;
  capturedAt: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  mimeType: "audio/wav" | "audio/webm" | "audio/mp3";
  dataUrl?: string;
};

export type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
};

export type VtsHotkey = {
  id: string;
  name: string;
  type?: string;
};
~~~

### 6.2 Processor ActionPlan

Next.js returns this to Electron.

~~~typescript
export type ActionPlan = {
  schemaVersion: "2026-05-02";
  tickId: string;
  createdAt: string;

  response?: {
    text?: string;
    confidence?: number;
    visibleToUser: boolean;
  };

  actions: LocalAction[];

  safety: {
    riskLevel: "low" | "medium" | "high";
    requiresConfirmation: boolean;
    reason?: string;
  };

  nextTick: {
    suggestedDelayMs: number;
    priority: "low" | "normal" | "high";
  };

  debug?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    rawToolCalls?: unknown[];
  };
};

export type LocalAction =
  | TriggerVtsHotkeyAction
  | SetVtsParameterAction
  | ObsSceneAction
  | ObsSourceVisibilityAction
  | SendOverlayMessageAction
  | LogEventAction
  | NoopAction;

export type TriggerVtsHotkeyAction = {
  type: "vts.trigger_hotkey";
  actionId: string;
  hotkeyId: string;
  intensity?: number;
  reason: string;
  cooldownMs?: number;
};

export type SetVtsParameterAction = {
  type: "vts.set_parameter";
  actionId: string;
  parameterId: string;
  value: number;
  weight?: number;
  durationMs?: number;
  reason: string;
};

export type ObsSceneAction = {
  type: "obs.set_scene";
  actionId: string;
  sceneName: string;
  reason: string;
};

export type ObsSourceVisibilityAction = {
  type: "obs.set_source_visibility";
  actionId: string;
  sceneName: string;
  sourceName: string;
  visible: boolean;
  reason: string;
};

export type SendOverlayMessageAction = {
  type: "overlay.message";
  actionId: string;
  message: string;
  displayDurationMs: number;
  reason: string;
};

export type LogEventAction = {
  type: "log.event";
  actionId: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
};

export type NoopAction = {
  type: "noop";
  actionId: string;
  reason: string;
};
~~~

---

## 7. API Surface

### 7.1 Next.js Processor API

The Next.js app is API-only. It does not serve the desktop UI.

~~~text
POST /api/process
POST /api/transcribe
POST /api/tool-result
GET  /api/health
GET  /api/models
~~~

#### `POST /api/process`

Input:

~~~typescript
export type ProcessRequest = {
  observation: ObservationEnvelope;
};
~~~

Output:

~~~typescript
export type ProcessResponse = {
  ok: boolean;
  actionPlan?: ActionPlan;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
~~~

Purpose:

Receives one observation tick from Electron, calls the LLM backend, validates the result, and returns a local action plan.

#### `POST /api/transcribe`

Input:

~~~typescript
export type TranscribeRequest = {
  sessionId: string;
  audio: CapturedAudioChunk;
};
~~~

Output:

~~~typescript
export type TranscribeResponse = {
  ok: boolean;
  transcript?: TranscriptSegment[];
  error?: {
    code: string;
    message: string;
  };
};
~~~

Purpose:

Optional audio transcription endpoint. Electron can either send audio directly to the LLM backend or route it through this processor endpoint.

#### `POST /api/tool-result`

Input:

~~~typescript
export type ToolResultRequest = {
  sessionId: string;
  tickId: string;
  actionResults: LocalActionResult[];
};
~~~

Purpose:

Electron reports whether local actions succeeded, failed, or were blocked.

~~~typescript
export type LocalActionResult = {
  actionId: string;
  type: LocalAction["type"];
  status: "success" | "failed" | "blocked" | "skipped";
  message?: string;
  metadata?: Record<string, unknown>;
};
~~~

---

### 7.2 Optional Electron Local API

This API is optional and should only bind to loopback.

~~~text
GET  /local/v1/health
GET  /local/v1/status
POST /local/v1/actions/execute
POST /local/v1/capture/snapshot
POST /local/v1/logs
~~~

Primary usage:

- local debugging
- same-machine processor mode
- future plugins
- manual trigger tools

It should not be the default remote-control path.

---

## 8. Corrected Process Structure

~~~text
beaverhack2026/
├── package.json
├── turbo.json                         # optional monorepo runner
├── pnpm-workspace.yaml                # optional
├── SPEC.md
│
├── apps/
│   ├── desktop/                       # Electron app
│   │   ├── package.json
│   │   ├── electron-builder.yml
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── index.ts
│   │   │   │   ├── tray.ts
│   │   │   │   ├── ipc/
│   │   │   │   │   ├── capture.ipc.ts
│   │   │   │   │   ├── obs.ipc.ts
│   │   │   │   │   ├── vts.ipc.ts
│   │   │   │   │   ├── processor.ipc.ts
│   │   │   │   │   └── settings.ipc.ts
│   │   │   │   ├── local-api/
│   │   │   │   │   ├── server.ts
│   │   │   │   │   ├── auth.ts
│   │   │   │   │   └── routes.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── capture-orchestrator.service.ts
│   │   │   │   │   ├── obs.service.ts
│   │   │   │   │   ├── vts.service.ts
│   │   │   │   │   ├── action-executor.service.ts
│   │   │   │   │   ├── processor-client.service.ts
│   │   │   │   │   ├── scheduler.service.ts
│   │   │   │   │   ├── cooldown.service.ts
│   │   │   │   │   ├── settings.service.ts
│   │   │   │   │   └── logger.service.ts
│   │   │   │   └── windows/
│   │   │   │       ├── setup-window.ts
│   │   │   │       ├── status-window.ts
│   │   │   │       └── hidden-capture-window.ts
│   │   │   │
│   │   │   ├── preload/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── renderer/              # Electron UI only
│   │   │       ├── index.html
│   │   │       ├── src/
│   │   │       │   ├── App.tsx
│   │   │       │   ├── components/
│   │   │       │   │   ├── StatusPanel.tsx
│   │   │       │   │   ├── SettingsPanel.tsx
│   │   │       │   │   ├── LogViewer.tsx
│   │   │       │   │   └── HotkeyMapper.tsx
│   │   │       │   └── styles.css
│   │   │       └── vite.config.ts
│   │   │
│   │   └── resources/
│   │       └── icon.ico
│   │
│   └── processor/                     # Headless Next.js API server
│       ├── package.json
│       ├── next.config.ts
│       ├── src/
│       │   ├── app/
│       │   │   └── api/
│       │   │       ├── health/route.ts
│       │   │       ├── models/route.ts
│       │   │       ├── process/route.ts
│       │   │       ├── transcribe/route.ts
│       │   │       └── tool-result/route.ts
│       │   ├── services/
│       │   │   ├── llm-client.service.ts
│       │   │   ├── prompt-builder.service.ts
│       │   │   ├── action-planner.service.ts
│       │   │   ├── tool-call-parser.service.ts
│       │   │   ├── policy.service.ts
│       │   │   └── token-budget.service.ts
│       │   └── config/
│       │       └── env.ts
│       │
│       └── public/                    # unused or health/static only
│
└── packages/
    ├── shared/
    │   ├── src/
    │   │   ├── types/
    │   │   │   ├── observation.types.ts
    │   │   │   ├── action-plan.types.ts
    │   │   │   ├── obs.types.ts
    │   │   │   ├── vts.types.ts
    │   │   │   └── llm.types.ts
    │   │   ├── schemas/
    │   │   │   ├── observation.schema.ts
    │   │   │   ├── action-plan.schema.ts
    │   │   │   └── config.schema.ts
    │   │   └── constants.ts
    │   └── package.json
    │
    └── config/
        ├── eslint/
        └── tsconfig/
~~~

---

## 9. Input Pipeline

### 9.1 Electron Capture Responsibilities

Electron owns all local capture because browser/server environments cannot safely access OBS, VTS, microphone, camera, or desktop capture without local permissions.

Electron collects:

- camera/video frames
- screen/window frames
- microphone chunks
- optional audio transcripts
- OBS scene/source/stream state
- VTS hotkey/model/auth state
- local runtime status
- optional typed/manual user input

Capture may happen in:

~~~text
Electron renderer window
Electron hidden capture window
Electron offscreen capture window
~~~

The Electron main process coordinates capture, but browser-only APIs such as `MediaStream`, `MediaRecorder`, and `AudioContext` should run in a renderer/capture window.

### 9.2 Tick-Based Background Sampling

Default automatic mode:

~~~json
{
  "pipeline": {
    "autoTriggerEnabled": true,
    "autoTriggerIntervalMs": 5000,
    "eventTriggeredProcessing": true,
    "manualTriggerEnabled": true,
    "maxActionsPerTick": 3
  }
}
~~~

Trigger sources:

| Trigger | Description |
|---|---|
| Timer tick | Every N milliseconds |
| OBS event | Scene change, stream start, recording start |
| VTS event | Model loaded, hotkey list changed |
| Audio event | Speech detected, keyword detected |
| Manual event | User clicks “analyze now” |
| Safety event | Error, disconnect, recovery |

### 9.3 Payload Strategy

Electron should not send every raw frame or every raw audio chunk on every tick.

Recommended payload priority:

1. Current OBS state
2. Latest transcript segments
3. Recent sampled frames
4. Recent screen/window frames
5. User text, if any
6. Recent action history
7. Available hotkeys and tool allowlist

---

## 10. Next.js Processor Behavior

The Next.js processor is not a frontend. It acts like a decision service.

For each `/api/process` request:

~~~text
1. Validate ObservationEnvelope with Zod.
2. Apply privacy and policy filters.
3. Compress or summarize old context.
4. Build OpenAI-compatible multimodal messages.
5. Attach tool schemas.
6. Send request to LLM backend.
7. Parse text and tool calls.
8. Convert tool calls into ActionPlan.
9. Validate ActionPlan with Zod.
10. Return ActionPlan to Electron.
~~~

The processor should not directly execute:

- OBS scene switches
- OBS source visibility changes
- VTS hotkeys
- VTS parameter injection
- local file writes on the desktop
- microphone/camera/screen capture

Those actions are returned to Electron as structured intents.

---

## 11. Local Action Execution

Electron receives an ActionPlan and executes it through `ActionExecutorService`.

Execution flow:

~~~text
1. Validate ActionPlan schema.
2. Check autonomy level.
3. Check action allowlist.
4. Check cooldowns.
5. Check rate limits.
6. Check whether confirmation is required.
7. Execute actions locally.
8. Log results.
9. Send results back to Next.js processor.
~~~

Example allowlist:

~~~json
{
  "allowedActions": [
    "vts.trigger_hotkey",
    "overlay.message",
    "log.event"
  ],
  "blockedActions": [
    "obs.set_scene",
    "obs.set_source_visibility"
  ],
  "confirmationRequired": [
    "obs.set_scene",
    "obs.set_source_visibility"
  ]
}
~~~

This allows the system to run safely in the background while preventing the AI from randomly changing stream scenes unless the user explicitly allows it.

---

## 12. VTube Studio Integration

### 12.1 Protocol

VTube Studio integration uses the VTube Studio Public API over WebSocket.

Default endpoint:

~~~text
ws://localhost:8001
~~~

### 12.2 Authentication Flow

Electron connects to VTube Studio and requests plugin authentication.

~~~json
{
  "apiName": "VTubeStudioPublicAPI",
  "apiVersion": "1.0",
  "requestID": "auth-token-request",
  "messageType": "AuthenticationTokenRequest",
  "data": {
    "pluginName": "Beaverhack2026",
    "pluginDeveloper": "Beaverhack2026 Team",
    "pluginIcon": ""
  }
}
~~~

After the user approves the plugin in VTube Studio, Electron stores the token securely.

### 12.3 Hotkey Triggering

Electron triggers hotkeys using VTS WebSocket requests.

~~~json
{
  "apiName": "VTubeStudioPublicAPI",
  "apiVersion": "1.0",
  "requestID": "trigger-emote-happy",
  "messageType": "HotkeyTriggerRequest",
  "data": {
    "hotkeyID": "emote_happy"
  }
}
~~~

The processor may suggest:

~~~json
{
  "type": "vts.trigger_hotkey",
  "actionId": "action_001",
  "hotkeyId": "emote_happy",
  "intensity": 0.8,
  "reason": "The streamer laughed and the avatar should react happily.",
  "cooldownMs": 3000
}
~~~

Electron decides whether to execute it.

---

## 13. OBS Integration

Electron connects to OBS through obs-websocket v5.

Default endpoint:

~~~text
ws://localhost:4455
~~~

Electron should subscribe to:

- current program scene changes
- stream state changes
- recording state changes
- source visibility changes
- scene item changes

Electron sends summarized OBS state to the processor.

Example:

~~~json
{
  "connected": true,
  "currentScene": "Gaming",
  "activeSources": [
    "Game Capture",
    "VTube Studio",
    "Alerts",
    "Chat"
  ],
  "streamStatus": "live",
  "recordingStatus": "inactive"
}
~~~

---

## 14. Background Desktop UX

The app should be designed as a background system first.

### 14.1 Main UX Modes

| Mode | Description |
|---|---|
| Setup Mode | First-run permissions, OBS connection, VTS auth, LLM endpoint config |
| Background Mode | Runs from tray/menu bar with minimal UI |
| Status Mode | Shows connections, recent actions, logs, capture health |
| Manual Control Mode | Lets user test hotkeys, trigger analysis, pause automation |
| Safe Mode | Disables action execution but keeps logging and diagnostics |

### 14.2 Electron UI Pages

The Electron UI should include:

- Setup wizard
- Connection status
- Capture permissions
- OBS settings
- VTube Studio settings
- Hotkey mapper
- Automation/autonomy controls
- Action log
- Error log
- Manual “analyze now” button
- Pause/resume automation button

There is no Next.js frontend page.

---

## 15. Configuration

### 15.1 Desktop Agent Config

~~~json
{
  "desktop": {
    "startMinimized": true,
    "minimizeToTray": true,
    "autoStartOnLogin": false,
    "localApiEnabled": true,
    "localApiHost": "127.0.0.1",
    "localApiPort": 39731
  },
  "processor": {
    "baseUrl": "http://localhost:3000",
    "apiToken": null,
    "requestTimeoutMs": 30000
  },
  "llm": {
    "baseUrl": "http://localhost:8000/v1",
    "model": "nemotron-nano-omni-v3",
    "temperature": 0.4,
    "maxTokens": 1024,
    "maxContextTokens": 262144
  },
  "vts": {
    "host": "localhost",
    "webSocketPort": 8001,
    "authToken": null,
    "autoConnect": true
  },
  "obs": {
    "host": "localhost",
    "port": 4455,
    "password": "",
    "autoConnect": true
  },
  "capture": {
    "camera": {
      "enabled": true,
      "fps": 1,
      "maxFrames": 32,
      "resolution": "1280x720",
      "jpegQuality": 75
    },
    "screen": {
      "enabled": true,
      "fps": 0.5,
      "maxFrames": 16,
      "resolution": "1280x720",
      "jpegQuality": 70
    },
    "audio": {
      "enabled": true,
      "sampleRate": 16000,
      "channels": 1,
      "bufferDurationSeconds": 60,
      "transcriptionEnabled": true
    }
  },
  "automation": {
    "enabled": true,
    "autonomyLevel": "auto_safe",
    "tickIntervalMs": 5000,
    "maxActionsPerTick": 3,
    "globalActionCooldownMs": 1000
  },
  "safety": {
    "requireConfirmationForObsSceneChanges": true,
    "requireConfirmationForSourceVisibility": true,
    "allowVtsHotkeysWithoutConfirmation": true,
    "allowOverlayMessagesWithoutConfirmation": true
  }
}
~~~

### 15.2 Environment Variables

| Variable | Owner | Description | Default |
|---|---|---|---|
| `PROCESSOR_BASE_URL` | Electron | Next.js processor URL | `http://localhost:3000` |
| `PROCESSOR_API_TOKEN` | Electron/Next | Shared API auth token | empty |
| `LLM_BASE_URL` | Next.js | OpenAI-compatible LLM URL | `http://localhost:8000/v1` |
| `LLM_MODEL` | Next.js | Model name | `nemotron-nano-omni-v3` |
| `VTS_HOST` | Electron | VTube Studio host | `localhost` |
| `VTS_WS_PORT` | Electron | VTube Studio WebSocket port | `8001` |
| `OBS_HOST` | Electron | OBS host | `localhost` |
| `OBS_PORT` | Electron | OBS WebSocket port | `4455` |
| `OBS_PASSWORD` | Electron | OBS WebSocket password | empty |
| `ELECTRON_LOCAL_API_PORT` | Electron | Optional local API port | `39731` |

---

## 16. Processor System Prompt Template

~~~text
You are Beaverhack2026, a VTuber stream-direction agent.

You receive structured observations from a local Electron desktop agent. You do not directly control OBS, VTube Studio, the microphone, the camera, or the screen. Instead, you produce a structured ActionPlan. Electron will validate and execute allowed actions locally.

Your goals:
1. Understand streamer context from audio transcripts, video frames, screen frames, OBS state, and VTube Studio state.
2. Select helpful avatar reactions, stream overlay messages, or safe OBS suggestions.
3. Avoid over-triggering actions.
4. Respect action cooldowns, tool allowlists, and autonomy level.
5. Prefer subtle useful actions over noisy behavior.

Rules:
- Return only valid structured actions.
- Do not request actions outside the provided tool list.
- Do not trigger VTS hotkeys repeatedly without a clear reason.
- Do not switch OBS scenes unless the observation strongly supports it and policy allows it.
- If unsure, return a noop action with a reason.
- Keep visible messages short and stream-friendly.

Current OBS state:
{obs_state}

Current VTube Studio state:
{vts_state}

Available VTS hotkeys:
{hotkey_list}

Allowed actions:
{allowed_actions}

Recent action history:
{recent_action_history}
~~~

---

## 17. Development Scripts

### 17.1 Local Development

~~~bash
# Install dependencies
pnpm install

# Start Next.js processor API
pnpm --filter @beaverhack/processor dev

# Start Electron desktop agent
pnpm --filter @beaverhack/desktop dev
~~~

### 17.2 Production Build

~~~bash
# Build shared packages
pnpm --filter @beaverhack/shared build

# Build Next.js processor
pnpm --filter @beaverhack/processor build

# Build Electron desktop app
pnpm --filter @beaverhack/desktop build
~~~

### 17.3 Runtime Deployment Options

#### Option A: All Local

~~~text
Electron desktop agent: local
Next.js processor: local
LLM backend: local GPU machine or same machine
OBS/VTS: local
~~~

#### Option B: Local Electron + Remote Processor

~~~text
Electron desktop agent: streamer PC
Next.js processor: remote server
LLM backend: GPU server
OBS/VTS: streamer PC
~~~

In this mode, Electron must initiate outbound requests. The remote processor should not attempt to call Electron localhost directly.

#### Option C: Local Electron + Local Processor + Remote LLM

~~~text
Electron desktop agent: streamer PC
Next.js processor: streamer PC
LLM backend: GPU server
OBS/VTS: streamer PC
~~~

This is the recommended hackathon architecture because it keeps local control local while offloading model inference.

---

## 18. Sections To Remove Or Rewrite From The Original Spec

Remove or rewrite these assumptions:

1. "Electron desktop app with a Next.js + React frontend"
2. "Next.js renderer process"
3. `src/renderer/app/api`
4. Zustand stores inside a Next.js renderer
5. Chat-first dashboard as the main product
6. VTS UDP/TCP hotkey path
7. Main process directly owning `MediaStream` / `MediaRecorder`
8. Tool calls directly executed by the processor
9. Next.js serving the desktop UI
10. Production build flow that exports a Next.js frontend into Electron

Replace them with:

1. Electron desktop UI and background agent
2. Next.js API-only processor
3. Shared Zod schemas
4. Electron local action executor
5. Background tick scheduler
6. VTS WebSocket client
7. OBS WebSocket client
8. ObservationEnvelope -> ActionPlan flow
9. Safety policy and autonomy levels
10. Loopback-only optional local API

---

## 19. Important Design Warning

Do not let the LLM directly execute OBS or VTube Studio actions.

The LLM should only produce structured intent. The Next.js processor should convert that intent into an `ActionPlan`. Electron should validate that plan, check cooldowns, check the autonomy level, check allowlists, and then execute only approved actions locally.

This keeps the system useful as an automatic background assistant without letting the AI randomly switch scenes, spam emotes, hide sources, or disrupt the stream.