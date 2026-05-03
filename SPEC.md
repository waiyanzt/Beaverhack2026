# AuTuber Desktop Agent Specification

## 1. Purpose

AuTuber is a desktop background agent that observes local streaming context and controls local streaming tools.

The app captures selected local inputs, builds a structured observation, sends it to a configured model provider, receives an action plan, validates the action plan, and executes approved local actions through OBS and VTube Studio.

Primary runtime flow:

~~~text
Capture inputs -> Build observation -> Call model -> Parse action plan -> Validate actions -> Execute local actions
~~~

The app lives in:

~~~text
autuber/electron
~~~

The repository root is reserved for workspace configuration, docs, shared packages, and future apps.

---

## 2. Repository Structure

~~~text
autuber/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── README.md
├── SPEC.md
├── .gitignore
├── .env.example
│
├── electron/
│   ├── package.json
│   ├── tsconfig.json
│   ├── electron-builder.yml
│   ├── vite.config.ts
│   ├── index.html
│   │
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.ts
│   │   │   ├── tray.ts
│   │   │   │
│   │   │   ├── windows/
│   │   │   │   ├── setup-window.ts
│   │   │   │   ├── status-window.ts
│   │   │   │   └── hidden-capture-window.ts
│   │   │   │
│   │   │   ├── ipc/
│   │   │   │   ├── automation.ipc.ts
│   │   │   │   ├── capture.ipc.ts
│   │   │   │   ├── model.ipc.ts
│   │   │   │   ├── obs.ipc.ts
│   │   │   │   ├── settings.ipc.ts
│   │   │   │   └── vts.ipc.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── automation/
│   │   │   │   │   ├── action-executor.service.ts
│   │   │   │   │   ├── action-plan-parser.service.ts
│   │   │   │   │   ├── action-validator.service.ts
│   │   │   │   │   ├── cooldown.service.ts
│   │   │   │   │   ├── observation-builder.service.ts
│   │   │   │   │   ├── pipeline.service.ts
│   │   │   │   │   ├── prompt-builder.service.ts
│   │   │   │   │   └── scheduler.service.ts
│   │   │   │   │
│   │   │   │   ├── capture/
│   │   │   │   │   ├── audio-buffer.service.ts
│   │   │   │   │   ├── capture-orchestrator.service.ts
│   │   │   │   │   ├── frame-buffer.service.ts
│   │   │   │   │   └── transcription.service.ts
│   │   │   │   │
│   │   │   │   ├── model/
│   │   │   │   │   ├── model-provider.types.ts
│   │   │   │   │   ├── model-router.service.ts
│   │   │   │   │   ├── openai-compatible.provider.ts
│   │   │   │   │   ├── openrouter.provider.ts
│   │   │   │   │   ├── self-hosted.provider.ts
│   │   │   │   │   └── mock.provider.ts
│   │   │   │   │
│   │   │   │   ├── obs/
│   │   │   │   │   └── obs.service.ts
│   │   │   │   │
│   │   │   │   ├── vts/
│   │   │   │   │   └── vts.service.ts
│   │   │   │   │
│   │   │   │   ├── settings/
│   │   │   │   │   ├── secret-store.service.ts
│   │   │   │   │   └── settings.service.ts
│   │   │   │   │
│   │   │   │   └── logger/
│   │   │   │       └── logger.service.ts
│   │   │   │
│   │   │   ├── local-api/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── server.ts
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── base64.ts
│   │   │       ├── ids.ts
│   │   │       └── time.ts
│   │   │
│   │   ├── preload/
│   │   │   └── index.ts
│   │   │
│   │   ├── renderer/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── CapturePanel.tsx
│   │   │   │   ├── HotkeyMapper.tsx
│   │   │   │   ├── LogViewer.tsx
│   │   │   │   ├── ManualControlPanel.tsx
│   │   │   │   ├── ModelProviderPanel.tsx
│   │   │   │   ├── SettingsPanel.tsx
│   │   │   │   └── StatusPanel.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useAutomation.ts
│   │   │   │   ├── useCapture.ts
│   │   │   │   ├── useModelProvider.ts
│   │   │   │   ├── useOBS.ts
│   │   │   │   └── useVTS.ts
│   │   │   │
│   │   │   ├── styles/
│   │   │   │   └── globals.css
│   │   │   │
│   │   │   └── types/
│   │   │       └── electron-api.d.ts
│   │   │
│   │   └── shared/
│   │       ├── constants.ts
│   │       │
│   │       ├── schemas/
│   │       │   ├── action-plan.schema.ts
│   │       │   ├── config.schema.ts
│   │       │   ├── model.schema.ts
│   │       │   └── observation.schema.ts
│   │       │
│   │       └── types/
│   │           ├── action-plan.types.ts
│   │           ├── config.types.ts
│   │           ├── model.types.ts
│   │           ├── obs.types.ts
│   │           ├── observation.types.ts
│   │           └── vts.types.ts
│   │
│   ├── resources/
│   │   └── icon.ico
│   │
│   └── tests/
│       ├── e2e/
│       ├── integration/
│       └── unit/
│
├── apps/
│   └── .gitkeep
│
├── packages/
│   └── .gitkeep
│
├── docs/
│   ├── architecture.md
│   ├── security.md
│   └── setup.md
│
├── models/
│   ├── prompts/
│   │   ├── action-planner-prompt.md
│   │   └── system-prompt.md
│   └── providers.md
│
└── scripts/
    ├── build-electron.sh
    ├── clean.sh
    └── dev-electron.sh
~~~

---

## 3. Runtime Components

### 3.1 Electron Main Process

The main process owns privileged app behavior.

Responsibilities:

- Create and manage windows.
- Create and manage tray/menu-bar behavior.
- Load and save settings.
- Store secrets securely.
- Connect to OBS.
- Connect to VTube Studio.
- Call model providers.
- Build prompts and payloads.
- Parse model responses.
- Validate action plans.
- Execute approved actions.
- Emit logs to renderer.
- Start and stop automation scheduler.

The main process must not expose raw secrets to the renderer.

### 3.2 Electron Renderer

The renderer owns user-facing app UI.

Responsibilities:

- Setup screen.
- Status screen.
- Capture controls.
- OBS connection controls.
- VTube Studio connection controls.
- Model provider settings.
- Hotkey mapping UI.
- Manual action testing.
- Log viewer.

The renderer communicates with the main process through the preload IPC API only.

### 3.3 Hidden Capture Window

The hidden capture window owns browser media APIs.

Responsibilities:

- Request microphone permission.
- Request camera permission.
- Request screen/window capture permission.
- Run `navigator.mediaDevices.getUserMedia`.
- Run `MediaRecorder`.
- Sample video frames into canvas.
- Record short camera/screen video clips.
- Encode frames as JPEG/PNG data URLs.
- Send sampled frames/audio chunks to the main process.

---

## 4. Runtime Flow

### 4.1 Startup

~~~text
1. Electron app starts.
2. Main process loads settings.
3. Main process initializes logger.
4. Main process creates tray icon.
5. Main process opens setup window if first run is incomplete.
6. Main process initializes OBS service.
7. Main process initializes VTube Studio service.
8. Main process initializes model router.
9. Main process initializes capture orchestrator.
10. Main process initializes automation scheduler.
~~~

### 4.2 Automation Tick

~~~text
1. Scheduler triggers a pipeline tick.
2. ObservationBuilder collects current state:
   - recent camera frames
   - recent screen frames
   - recent transcript segments
   - OBS state
   - VTube Studio state
   - recent action history
   - recent model action-plan memory
3. PromptBuilder creates system and user messages.
4. ModelRouter sends request to selected model provider.
5. ActionPlanParser extracts a structured action plan.
6. ActionValidator checks schema, allowlist, cooldowns, and autonomy level.
7. ActionExecutor executes approved actions.
8. Logger stores action results.
9. Renderer receives updated status/log events.
~~~

### 4.3 Manual Analysis

~~~text
1. User clicks "Analyze Now".
2. Renderer invokes `automation:analyze-now`.
3. Main process runs one pipeline tick immediately.
4. Main process returns result summary to renderer.
~~~

## 4.4 Runtime Flow Diagram

~~~mermaid
flowchart TD
  A[Electron App Starts] --> B[Load Settings]
  B --> C[Initialize Services]

  C --> C1[LoggerService]
  C --> C2[SettingsService]
  C --> C3[OBSService]
  C --> C4[VTSService]
  C --> C5[ModelRouter]
  C --> C6[CaptureOrchestrator]
  C --> C7[SchedulerService]

  C7 --> D{Trigger Type}

  D -->|Timer Tick| E[Run Automation Pipeline]
  D -->|Analyze Now| E
  D -->|OBS Event| E
  D -->|VTS Event| E
  D -->|Capture Event| E

  E --> F[Build ObservationEnvelope]

  F --> F1[Collect OBS State]
  F --> F2[Collect VTS State]
  F --> F3[Collect Recent Frames]
  F --> F4[Collect Audio Transcript]
  F --> F5[Collect Recent Actions]
  F --> F6[Collect Runtime Policy]

  F1 --> G[Build Model Prompt]
  F2 --> G
  F3 --> G
  F4 --> G
  F5 --> G
  F6 --> G

  G --> H[Send Request Through ModelRouter]

  H --> I{Selected Provider}

  I -->|OpenRouter| J[OpenRouter Provider]
  I -->|Self Hosted| K[OpenAI Compatible Provider]
  I -->|Mock| L[Mock Provider]

  J --> M[Receive Model Response]
  K --> M
  L --> M

  M --> N[Parse ActionPlan]
  N --> O{Valid ActionPlan?}

  O -->|No| P[Log Parse/Schema Error]
  P --> Q[Return Failed Pipeline Result]

  O -->|Yes| R[Validate Actions]

  R --> R1[Check Action Count]
  R --> R2[Check Allowed Actions]
  R --> R3[Check Blocked Actions]
  R --> R4[Check Cooldowns]
  R --> R5[Check Autonomy Level]
  R --> R6[Check Confirmation Requirements]

  R1 --> S{Approved?}
  R2 --> S
  R3 --> S
  R4 --> S
  R5 --> S
  R6 --> S

  S -->|No| T[Create Blocked Action Results]
  T --> U[Log Blocked Actions]
  U --> V[Update Renderer Status]

  S -->|Yes| W[Execute Approved Actions]

  W --> W1[VTS Hotkey Action]
  W --> W2[VTS Parameter Action]
  W --> W3[OBS Scene Action]
  W --> W4[OBS Source Visibility Action]
  W --> W5[Overlay Message Action]
  W --> W6[Log Event Action]
  W --> W7[Noop Action]

  W1 --> X[Collect Action Results]
  W2 --> X
  W3 --> X
  W4 --> X
  W5 --> X
  W6 --> X
  W7 --> X

  X --> Y[Store Recent Action History]
  Y --> Z[Emit Logs To Renderer]
  Z --> AA[Return Completed Pipeline Result]
~~~

---

## 4.5 Service Boundary Diagram

~~~mermaid
flowchart LR
  subgraph Renderer[Electron Renderer]
    UI[Status / Settings UI]
    CaptureUI[Capture Controls]
    LogsUI[Log Viewer]
  end

  subgraph Preload[Preload Bridge]
    IPCAPI[Typed IPC API]
  end

  subgraph Main[Electron Main Process]
    Settings[SettingsService]
    Secrets[SecretStoreService]
    Logger[LoggerService]
    Scheduler[SchedulerService]
    Pipeline[PipelineService]
    Observation[ObservationBuilder]
    Prompt[PromptBuilder]
    ModelRouter[ModelRouter]
    Parser[ActionPlanParser]
    Validator[ActionValidator]
    Executor[ActionExecutor]
    OBS[OBSService]
    VTS[VTSService]
    Capture[CaptureOrchestrator]
  end

  subgraph HiddenCapture[Hidden Capture Window]
    Media[Media APIs]
    Frames[Frame Sampler]
    Audio[Audio Recorder]
  end

  subgraph LocalApps[Local Streaming Apps]
    OBSApp[OBS Studio]
    VTSApp[VTube Studio]
  end

  subgraph Providers[Model Providers]
    OpenRouter[OpenRouter]
    SelfHosted[Self Hosted OpenAI-Compatible Model]
    Mock[Mock Provider]
  end

  UI --> IPCAPI
  CaptureUI --> IPCAPI
  LogsUI --> IPCAPI
  IPCAPI --> Main

  Scheduler --> Pipeline
  Pipeline --> Observation
  Observation --> OBS
  Observation --> VTS
  Observation --> Capture
  Observation --> Prompt
  Prompt --> ModelRouter
  ModelRouter --> OpenRouter
  ModelRouter --> SelfHosted
  ModelRouter --> Mock
  ModelRouter --> Parser
  Parser --> Validator
  Validator --> Executor

  Executor --> OBS
  Executor --> VTS
  Executor --> Logger

  Capture --> HiddenCapture
  HiddenCapture --> Media
  Media --> Frames
  Media --> Audio

  OBS --> OBSApp
  VTS --> VTSApp

  Logger --> LogsUI
  Settings --> UI
  Secrets --> Settings
~~~

---

## 5. Data Contracts

### 5.1 ObservationEnvelope

~~~typescript
export type ObservationEnvelope = {
  schemaVersion: "2026-05-02";
  sessionId: string;
  tickId: string;
  createdAt: string;

  source: {
    app: "autuber-electron-agent";
    hostId: string;
    userMode: "background" | "setup" | "manual";
  };

  capture: {
    cameraFrames: CapturedFrame[];
    screenFrames: CapturedFrame[];
    cameraClips?: CapturedVideoClip[];
    screenClips?: CapturedVideoClip[];
    audio: CapturedAudioChunk[];
    transcript?: TranscriptSegment[];
    userText?: string;
  };

  obs: ObsStateSnapshot;
  vts: VtsStateSnapshot;
  runtime: RuntimeSnapshot;
  policy: RuntimePolicy;

  recentActions: LocalActionResult[];
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

export type CapturedVideoClip = {
  id: string;
  kind: "camera" | "screen";
  capturedAt: string;
  durationMs: number;
  mimeType: string;
  dataUrl?: string;
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

export type ObsStateSnapshot = {
  connected: boolean;
  currentScene?: string;
  activeSources?: string[];
  streamStatus?: "offline" | "starting" | "live" | "stopping";
  recordingStatus?: "inactive" | "starting" | "recording" | "stopping";
  transitionName?: string;
};

export type VtsStateSnapshot = {
  connected: boolean;
  authenticated: boolean;
  currentModelName?: string;
  availableHotkeys?: VtsHotkey[];
  lastTriggeredHotkeyId?: string;
};

export type VtsHotkey = {
  id: string;
  name: string;
  type?: string;
};

export type RuntimeSnapshot = {
  batterySaver?: boolean;
  cpuLoad?: number;
  memoryUsedMb?: number;
  foregroundApp?: string;
};

export type RuntimePolicy = {
  autonomyLevel: "paused" | "suggest_only" | "auto_safe" | "auto_full" | "safe_mode";
  allowedActions: string[];
  blockedActions: string[];
  maxActionsPerTick: number;
};
~~~

### 5.2 ActionPlan

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
    provider?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
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

export type LocalActionResult = {
  actionId: string;
  type: LocalAction["type"];
  status: "success" | "failed" | "blocked" | "skipped";
  message?: string;
  metadata?: Record<string, unknown>;
};
~~~

---

## 6. Configuration

### 6.1 App Config

~~~typescript
export type AppConfig = {
  desktop: DesktopConfig;
  model: ModelConfig;
  providers: ProviderConfigs;
  obs: ObsConfig;
  vts: VtsConfig;
  capture: CaptureConfig;
  automation: AutomationConfig;
  safety: SafetyConfig;
};

export type DesktopConfig = {
  startMinimized: boolean;
  minimizeToTray: boolean;
  autoStartOnLogin: boolean;
  localApiEnabled: boolean;
  localApiHost: string;
  localApiPort: number;
};

export type ModelConfig = {
  provider: "openrouter" | "selfHosted" | "mock";
  fallbackProvider?: "openrouter" | "selfHosted" | "mock";
  temperature: number;
  maxTokens: number;
  maxContextTokens: number;
};

export type ProviderConfigs = {
  openrouter: ModelProviderConfig;
  selfHosted: ModelProviderConfig;
  mock: ModelProviderConfig;
};

export type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  timeoutMs: number;
  supportsVision: boolean;
  supportsAudioInput: boolean;
  supportsToolCalling: boolean;
  supportsJsonMode: boolean;
};

export type ObsConfig = {
  host: string;
  port: number;
  password: string;
  autoConnect: boolean;
};

export type VtsConfig = {
  host: string;
  webSocketPort: number;
  authToken: string | null;
  autoConnect: boolean;
};

export type CaptureConfig = {
  camera: CameraCaptureConfig;
  screen: ScreenCaptureConfig;
  audio: AudioCaptureConfig;
};

export type CameraCaptureConfig = {
  enabled: boolean;
  fps: number;
  maxFrames: number;
  resolution: string;
  jpegQuality: number;
};

export type ScreenCaptureConfig = {
  enabled: boolean;
  fps: number;
  maxFrames: number;
  resolution: string;
  jpegQuality: number;
};

export type AudioCaptureConfig = {
  enabled: boolean;
  sampleRate: number;
  channels: number;
  bufferDurationSeconds: number;
  transcriptionEnabled: boolean;
  sendRawAudio: boolean;
};

export type AutomationConfig = {
  enabled: boolean;
  autonomyLevel: "paused" | "suggest_only" | "auto_safe" | "auto_full" | "safe_mode";
  tickIntervalMs: number;
  maxActionsPerTick: number;
  globalActionCooldownMs: number;
};

export type SafetyConfig = {
  requireConfirmationForObsSceneChanges: boolean;
  requireConfirmationForSourceVisibility: boolean;
  allowVtsHotkeysWithoutConfirmation: boolean;
  allowOverlayMessagesWithoutConfirmation: boolean;
};
~~~

### 6.2 Default Config

~~~json
{
  "desktop": {
    "startMinimized": true,
    "minimizeToTray": true,
    "autoStartOnLogin": false,
    "localApiEnabled": false,
    "localApiHost": "100.93.134.64",
    "localApiPort": 39731
  },
  "model": {
    "provider": "openrouter",
    "fallbackProvider": "selfHosted",
    "temperature": 0.4,
    "maxTokens": 1024,
    "maxContextTokens": 262144
  },
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": null,
      "model": "",
      "timeoutMs": 30000,
      "supportsVision": true,
      "supportsAudioInput": false,
      "supportsToolCalling": true,
      "supportsJsonMode": true
    },
    "selfHosted": {
      "baseUrl": "http://localhost:8000/v1",
      "apiKey": null,
      "model": "",
      "timeoutMs": 60000,
      "supportsVision": true,
      "supportsAudioInput": true,
      "supportsToolCalling": true,
      "supportsJsonMode": true
    },
    "mock": {
      "baseUrl": "mock://local",
      "apiKey": null,
      "model": "mock-action-planner",
      "timeoutMs": 1000,
      "supportsVision": false,
      "supportsAudioInput": false,
      "supportsToolCalling": true,
      "supportsJsonMode": true
    }
  },
  "obs": {
    "host": "localhost",
    "port": 4455,
    "password": "",
    "autoConnect": true
  },
  "vts": {
    "host": "localhost",
    "webSocketPort": 8001,
    "authToken": null,
    "autoConnect": true
  },
  "capture": {
    "camera": {
      "enabled": true,
      "fps": 1,
      "maxFrames": 8,
      "resolution": "1280x720",
      "jpegQuality": 75
    },
    "screen": {
      "enabled": false,
      "fps": 0.5,
      "maxFrames": 4,
      "resolution": "1280x720",
      "jpegQuality": 70
    },
    "audio": {
      "enabled": true,
      "sampleRate": 16000,
      "channels": 1,
      "bufferDurationSeconds": 30,
      "transcriptionEnabled": true,
      "sendRawAudio": false
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

---

## 7. Model Provider

### 7.1 Provider Interface

~~~typescript
export type ModelGenerateRequest = {
  observation: ObservationEnvelope;
  systemPrompt: string;
  toolSchemas: ModelToolSchema[];
  responseMode: "json" | "tool_calls" | "text";
};

export type ModelGenerateResponse = {
  provider: string;
  model: string;
  content?: string;
  toolCalls?: ModelToolCall[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw: unknown;
};

export type ModelToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ModelToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ModelProvider = {
  generate(request: ModelGenerateRequest): Promise<ModelGenerateResponse>;
  transcribeAudio?(audio: CapturedAudioChunk): Promise<TranscriptSegment[]>;
  healthCheck(): Promise<boolean>;
};
~~~

### 7.2 Model Router Behavior

~~~text
1. Load selected provider config.
2. Run provider health check when requested by UI.
3. For each pipeline tick, call selected provider.
4. If selected provider fails and fallback exists, call fallback provider.
5. If both fail, return pipeline failure and enter safe mode.
6. Log provider errors without exposing API keys.
~~~

### 7.3 OpenAI-Compatible Request Shape

~~~json
{
  "model": "configured-model-name",
  "messages": [
    {
      "role": "system",
      "content": "system prompt"
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "serialized observation summary"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,...",
            "detail": "low"
          }
        }
      ]
    }
  ],
  "tools": [],
  "tool_choice": "auto",
  "temperature": 0.4,
  "max_tokens": 1024,
  "stream": false
}
~~~

---

## 8. Prompt Builder

### 8.1 System Prompt Template

~~~text
You are AuTuber, a VTuber stream-direction agent running inside a local desktop app.

You receive structured observations from local capture, OBS, and VTube Studio. You do not directly control the stream. You produce a structured ActionPlan. The desktop app validates and executes only allowed actions.

Goals:
1. Understand streamer context from transcript, frames, OBS state, and VTube Studio state.
2. Select useful avatar reactions, overlay messages, or stream-control suggestions.
3. Avoid over-triggering actions.
4. Respect cooldowns, allowlists, blocked actions, and autonomy level.
5. Prefer subtle useful reactions over noisy behavior.
6. If no action is needed, return a noop action.

Rules:
- Return only valid structured actions.
- Do not request actions outside the allowed action list.
- Do not trigger the same hotkey repeatedly without a clear reason.
- Do not switch OBS scenes unless policy allows it.
- Keep visible messages short.
- Include a short reason for every action.
~~~

### 8.2 Observation Summary Format

~~~typescript
export type ObservationSummaryForModel = {
  obs: ObsStateSnapshot;
  vts: VtsStateSnapshot;
  transcript?: TranscriptSegment[];
  userText?: string;
  allowedActions: string[];
  blockedActions: string[];
  recentActions: LocalActionResult[];
  recentModelActions: RecentModelActionMemoryEntry[];
};

export type RecentModelActionMemoryEntry = {
  sequence: number;
  storedAt: string;
  actionPlan: ActionPlan;
  actionResults: RecentModelActionMemoryResult[];
};

export type RecentModelActionMemoryResult = {
  actionId: string;
  type: LocalAction["type"];
  status: LocalActionResult["status"] | "confirmation_required" | "not_executed";
  reason: string;
  errorMessage?: string;
};
~~~

`recentModelActions` is a transient main-process sliding window of the last 10 parsed model action plans. Each entry includes the full validated `ActionPlan`, action reasons, safety assessment, and execution results so the next prompt can preserve contextual continuity without persisting provider output to disk.

---

## 9. Tool Schema

The model should produce actions through a single `create_action_plan` tool.

~~~typescript
export const createActionPlanTool: ModelToolSchema = {
  type: "function",
  function: {
    name: "create_action_plan",
    description: "Create a structured local action plan for the desktop app to validate and execute.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        response: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
            visibleToUser: {
              type: "boolean",
            },
          },
          required: ["visibleToUser"],
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              type: {
                type: "string",
              },
              actionId: {
                type: "string",
              },
              reason: {
                type: "string",
              },
            },
            required: ["type", "actionId", "reason"],
          },
        },
        safety: {
          type: "object",
          additionalProperties: false,
          properties: {
            riskLevel: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
            requiresConfirmation: {
              type: "boolean",
            },
            reason: {
              type: "string",
            },
          },
          required: ["riskLevel", "requiresConfirmation"],
        },
        nextTick: {
          type: "object",
          additionalProperties: false,
          properties: {
            suggestedDelayMs: {
              type: "number",
            },
            priority: {
              type: "string",
              enum: ["low", "normal", "high"],
            },
          },
          required: ["suggestedDelayMs", "priority"],
        },
      },
      required: ["actions", "safety", "nextTick"],
    },
  },
};
~~~

---

## 10. Action Validation

### 10.1 Validation Rules

~~~text
1. ActionPlan must match schema.
2. Action count must be <= maxActionsPerTick.
3. Action type must be in allowedActions.
4. Action type must not be in blockedActions.
5. Action must pass action-specific validation.
6. Action must pass cooldown check.
7. Action must pass autonomy-level check.
8. High-risk actions require confirmation.
9. Failed validation returns blocked action result.
~~~

### 10.2 Autonomy Levels

| Level | Behavior |
|---|---|
| `paused` | Do not run pipeline ticks |
| `suggest_only` | Build action plan but do not execute without approval |
| `auto_safe` | Execute safe actions such as VTS hotkeys, overlay messages, and logs |
| `auto_full` | Execute all allowlisted actions |
| `safe_mode` | Disable model calls and action execution |

### 10.3 Default Action Policy

~~~json
{
  "allowedActions": [
    "vts.trigger_hotkey",
    "overlay.message",
    "log.event",
    "noop"
  ],
  "blockedActions": [
    "obs.set_scene",
    "obs.set_source_visibility",
    "vts.set_parameter"
  ]
}
~~~

---

## 11. Action Execution

### 11.1 Supported Actions

| Action | Service | Default Permission |
|---|---|---|
| `vts.trigger_hotkey` | VTSService | Allowed in `auto_safe` |
| `vts.set_parameter` | VTSService | Confirmation required |
| `obs.set_scene` | OBSService | Confirmation required |
| `obs.set_source_visibility` | OBSService | Confirmation required |
| `overlay.message` | Overlay/local UI | Allowed in `auto_safe` |
| `log.event` | LoggerService | Allowed |
| `noop` | No service | Allowed |

### 11.2 Execution Result

Each attempted action returns a `LocalActionResult`.

~~~typescript
export type ExecuteActionResult = {
  action: LocalAction;
  result: LocalActionResult;
};
~~~

---

## 12. OBS Service

### 12.1 Responsibilities

- Connect to OBS WebSocket.
- Disconnect from OBS.
- Read current scene.
- Read current scene sources.
- Read stream status.
- Read recording status.
- Subscribe to scene change events.
- Subscribe to stream/recording state events.
- Execute allowed OBS actions.

### 12.2 Service Interface

~~~typescript
export type OBSService = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStateSnapshot(): Promise<ObsStateSnapshot>;
  setCurrentScene(sceneName: string): Promise<void>;
  setSourceVisibility(input: SetSourceVisibilityInput): Promise<void>;
};

export type SetSourceVisibilityInput = {
  sceneName: string;
  sourceName: string;
  visible: boolean;
};
~~~

---

## 13. VTube Studio Service

### 13.1 Responsibilities

- Connect to VTube Studio WebSocket.
- Request authentication token.
- Authenticate with stored token.
- Fetch available hotkeys.
- Trigger hotkeys.
- Read current model info.
- Execute allowed VTS actions.

### 13.2 Service Interface

~~~typescript
export type VTSService = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  authenticate(): Promise<void>;
  getStateSnapshot(): Promise<VtsStateSnapshot>;
  getHotkeys(): Promise<VtsHotkey[]>;
  triggerHotkey(hotkeyId: string): Promise<void>;
  setParameter?(input: SetVtsParameterInput): Promise<void>;
};

export type SetVtsParameterInput = {
  parameterId: string;
  value: number;
  weight?: number;
  durationMs?: number;
};
~~~

---

## 14. Capture Service

### 14.1 Responsibilities

- List available desktop capture sources.
- Start camera capture.
- Stop camera capture.
- Start screen/window capture.
- Stop screen/window capture.
- Start microphone capture.
- Stop microphone capture.
- Maintain frame buffers.
- Maintain audio buffers.
- Provide recent frames/audio/transcripts to ObservationBuilder.

### 14.2 Frame Defaults

| Source | FPS | Max Frames | Resolution | Encoding |
|---|---:|---:|---|---|
| Camera | 1 | 8 | 1280x720 | JPEG |
| Screen | 0.5 | 4 | 1280x720 | JPEG |
| Window | 0.5 | 4 | 1280x720 | JPEG |

### 14.3 Audio Defaults

| Property | Default |
|---|---|
| Sample Rate | 16000 |
| Channels | 1 |
| Buffer Duration | 30 seconds |
| Send Raw Audio | false |
| Prefer Transcript | true |

---

## 15. IPC API

### 15.1 Preload API

~~~typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("autuber", {
  automation: {
    start: () => ipcRenderer.invoke("automation:start"),
    stop: () => ipcRenderer.invoke("automation:stop"),
    analyzeNow: () => ipcRenderer.invoke("automation:analyze-now"),
    getStatus: () => ipcRenderer.invoke("automation:get-status"),
  },

  capture: {
    getSources: () => ipcRenderer.invoke("capture:get-sources"),
    startCamera: (sourceId: string) => ipcRenderer.invoke("capture:start-camera", sourceId),
    stopCamera: () => ipcRenderer.invoke("capture:stop-camera"),
    startScreen: (sourceId: string) => ipcRenderer.invoke("capture:start-screen", sourceId),
    stopScreen: () => ipcRenderer.invoke("capture:stop-screen"),
    startAudio: () => ipcRenderer.invoke("capture:start-audio"),
    stopAudio: () => ipcRenderer.invoke("capture:stop-audio"),
  },

  model: {
    testConnection: () => ipcRenderer.invoke("model:test-connection"),
    setProvider: (providerId: string) => ipcRenderer.invoke("model:set-provider", providerId),
    listProviders: () => ipcRenderer.invoke("model:list-providers"),
  },

  obs: {
    connect: () => ipcRenderer.invoke("obs:connect"),
    disconnect: () => ipcRenderer.invoke("obs:disconnect"),
    getStatus: () => ipcRenderer.invoke("obs:get-status"),
  },

  vts: {
    connect: () => ipcRenderer.invoke("vts:connect"),
    disconnect: () => ipcRenderer.invoke("vts:disconnect"),
    authenticate: () => ipcRenderer.invoke("vts:authenticate"),
    getHotkeys: () => ipcRenderer.invoke("vts:get-hotkeys"),
    triggerHotkey: (hotkeyId: string) => ipcRenderer.invoke("vts:trigger-hotkey", hotkeyId),
  },

  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (settings: unknown) => ipcRenderer.invoke("settings:update", settings),
  },

  logs: {
    list: () => ipcRenderer.invoke("logs:list"),
    clear: () => ipcRenderer.invoke("logs:clear"),
    onLog: (callback: (event: unknown) => void) => {
      ipcRenderer.on("logs:event", (_, payload) => callback(payload));
    },
  },
});
~~~

### 15.2 IPC Validation

Every IPC handler must:

~~~text
1. Validate input with Zod.
2. Reject unknown fields.
3. Return typed success/error result.
4. Avoid throwing raw errors to renderer.
5. Never return secrets to renderer.
~~~

---

## 16. Pipeline Service

~~~typescript
export class PipelineService {
  public async runOnce(trigger: PipelineTrigger): Promise<PipelineResult> {
    const observation = await this.observationBuilder.build(trigger);

    const systemPrompt = this.promptBuilder.buildSystemPrompt(observation);
    const toolSchemas = this.promptBuilder.buildToolSchemas(observation.policy);

    const modelResponse = await this.modelRouter.generate({
      observation,
      systemPrompt,
      toolSchemas,
      responseMode: "tool_calls",
    });

    const actionPlan = this.actionPlanParser.parse(modelResponse, observation.tickId);

    const validation = this.actionValidator.validate(actionPlan, observation.policy);

    if (!validation.ok) {
      return {
        ok: false,
        status: "blocked",
        reason: validation.reason,
        actionPlan,
        results: validation.results,
      };
    }

    const results = await this.actionExecutor.execute(actionPlan.actions);

    return {
      ok: true,
      status: "completed",
      actionPlan,
      results,
    };
  }
}

export type PipelineTrigger = {
  type: "timer" | "manual" | "obs_event" | "vts_event" | "capture_event";
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type PipelineResult = {
  ok: boolean;
  status: "completed" | "blocked" | "failed";
  reason?: string;
  actionPlan?: ActionPlan;
  results?: LocalActionResult[];
};
~~~

---

## 17. Logging

### 17.1 Log Event

~~~typescript
export type AppLogEvent = {
  id: string;
  createdAt: string;
  level: "debug" | "info" | "warn" | "error";
  source:
    | "automation"
    | "capture"
    | "model"
    | "obs"
    | "vts"
    | "settings"
    | "security"
    | "renderer";
  message: string;
  metadata?: Record<string, unknown>;
};
~~~

### 17.2 Required Logs

Log these events:

- app startup
- settings load failure
- OBS connection success/failure
- VTS connection success/failure
- VTS authentication success/failure
- model provider connection test
- automation start/stop
- pipeline tick start/end
- model request failure
- action plan parse failure
- blocked action
- executed action
- capture permission failure

Do not log:

- API keys
- OBS password
- VTS auth token
- raw screen frames
- raw microphone audio

---

## 18. Security Requirements

### 18.1 BrowserWindow Defaults

~~~typescript
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: path.join(__dirname, "preload.js"),
  },
});
~~~

### 18.2 Secret Handling

Secrets include:

- OpenRouter API key.
- Self-hosted API key if configured.
- OBS WebSocket password.
- VTube Studio auth token.
- Local API token if enabled.

Rules:

~~~text
1. Store secrets through SecretStoreService.
2. Never expose secrets to renderer.
3. Never log secrets.
4. Redact secrets from error messages.
5. Only the main process can call external model APIs.
~~~

### 18.3 Local API

The local API is disabled by default.

If enabled:

~~~text
1. Bind only to 100.93.134.64.
2. Require bearer token.
3. Validate all request bodies.
4. Do not expose secrets.
5. Do not allow unauthenticated action execution.
~~~

---

## 19. Root Workspace Files

### 19.1 `pnpm-workspace.yaml`

~~~yaml
packages:
  - "electron"
  - "apps/*"
  - "packages/*"
~~~

### 19.2 Root `package.json`

~~~json
{
  "name": "autuber",
  "private": true,
  "version": "0.1.0",
  "description": "AuTuber workspace.",
  "scripts": {
    "dev": "pnpm --filter @autuber/electron dev",
    "dev:electron": "pnpm --filter @autuber/electron dev",
    "build": "pnpm --filter @autuber/electron build",
    "build:electron": "pnpm --filter @autuber/electron build",
    "lint": "pnpm --filter @autuber/electron lint",
    "test": "pnpm --filter @autuber/electron test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.0.0"
  },
  "packageManager": "pnpm@10.0.0"
}
~~~

### 19.3 `electron/package.json`

~~~json
{
  "name": "@autuber/electron",
  "private": true,
  "version": "0.1.0",
  "description": "Desktop background agent for AuTuber.",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite --config vite.config.ts",
    "build": "tsc && vite build --config vite.config.ts",
    "electron:dev": "electron .",
    "electron:build": "electron-builder",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest"
  },
  "dependencies": {
    "@electron-toolkit/preload": "^3.0.0",
    "@electron-toolkit/utils": "^3.0.0",
    "electron-store": "^10.0.0",
    "obs-websocket-js": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "ws": "^8.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
~~~

---

## 20. Development Commands

From the repository root:

~~~bash
pnpm install
pnpm dev
~~~

Run Electron app explicitly:

~~~bash
pnpm --filter @autuber/electron dev
~~~

Build Electron app:

~~~bash
pnpm --filter @autuber/electron build
pnpm --filter @autuber/electron electron:build
~~~

Run tests:

~~~bash
pnpm --filter @autuber/electron test
~~~

---

## 21. Implementation Order

### Step 1: Project Skeleton

- Create workspace files.
- Create `electron` package.
- Add Electron + Vite + React.
- Add main process entry.
- Add preload bridge.
- Add renderer shell.

### Step 2: Settings And Logs

- Implement SettingsService.
- Implement SecretStoreService.
- Implement LoggerService.
- Add settings UI.
- Add log viewer UI.

### Step 3: OBS

- Implement OBSService.
- Connect/disconnect from OBS.
- Read current scene.
- Read stream/recording state.
- Display OBS status in UI.

### Step 4: VTube Studio

- Implement VTSService.
- Connect/disconnect from VTube Studio.
- Authenticate plugin.
- Fetch hotkey list.
- Trigger hotkeys manually from UI.

### Step 5: Model Provider

- Implement ModelProvider interface.
- Implement OpenRouter provider.
- Implement self-hosted OpenAI-compatible provider.
- Implement mock provider.
- Add model connection test.

### Step 6: Action Plan Pipeline

- Implement ObservationBuilder.
- Implement PromptBuilder.
- Implement ActionPlanParser.
- Implement ActionValidator.
- Implement ActionExecutor.
- Run manual pipeline from “Analyze Now”.

### Step 7: Automation

- Implement SchedulerService.
- Add start/stop automation.
- Add cooldown service.
- Add recent action history.
- Execute VTS hotkey actions automatically in `auto_safe`.

### Step 8: Capture

- Implement hidden capture window.
- Add camera frame sampling.
- Add screen/window frame sampling.
- Add microphone capture.
- Add transcript support.
- Add capture privacy toggles.

---

## 22. Minimum Demo Target

The minimum complete demo should support:

~~~text
1. App launches.
2. User connects to OBS.
3. User connects to VTube Studio.
4. User authenticates VTube Studio plugin.
5. App fetches VTS hotkeys.
6. User configures model provider.
7. User clicks Analyze Now.
8. App sends OBS state, VTS state, and optional text to model.
9. Model returns action plan.
10. App validates action plan.
11. App triggers a VTS hotkey.
12. App logs the full pipeline result.
~~~

Camera, screen, and audio capture can be added after the basic model-to-VTS loop works.
