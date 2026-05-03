# Beaverhack2026 Frontend Design Elements

Derived from SPEC.md. Intended as a design draft reference, not implementation code.

---

## App Shell

**Window chrome**
- Compact desktop window (approx. 900x620)
- Tray icon with context menu: Show, Hide, Start Automation, Stop Automation, Quit
- Minimize to tray on close

**Navigation**
- Sidebar or tab bar with sections: Status, Capture, OBS, VTube Studio, Model, Settings, Logs
- Active section indicator
- Global status badge (running / paused / error)

---

## 1. Status Panel

Primary at-a-glance view. Shown on launch after setup.

**Automation state block**
- Large label: RUNNING / PAUSED / SAFE MODE / SUGGEST ONLY
- Current autonomy level (e.g., `auto_safe`)
- Tick interval display (e.g., `every 5s`)
- Last tick timestamp
- Button: Analyze Now
- Button: Start / Stop Automation

**Service status row**
- OBS: connected indicator (dot) + current scene name
- VTube Studio: connected indicator + current model name
- Model provider: connected indicator + active provider name (e.g., `openrouter`)

**Last action summary**
- Most recent action type and reason
- Status badge: success / blocked / failed / skipped
- Timestamp

**Recent pipeline results list**
- 5-10 rows: tick timestamp, trigger type, action count, overall status
- Click to expand: full action list with per-action status

---

## 2. Capture Panel

Controls for camera, screen, and audio inputs.

**Camera section**
- Toggle: Enable camera capture
- Source selector dropdown (populated from capture:get-sources)
- FPS display (from config, read-only)
- Max frames display
- Resolution display
- Live preview thumbnail (small, low-res)
- Button: Start Camera / Stop Camera

**Screen / Window section**
- Toggle: Enable screen capture
- Source selector dropdown
- FPS display
- Resolution display
- Button: Start Screen / Stop Screen

**Audio / Microphone section**
- Toggle: Enable audio capture
- Toggle: Enable transcription
- Toggle: Send raw audio (off by default)
- Sample rate display
- Buffer duration display (e.g., `30s buffer`)
- Button: Start Audio / Stop Audio
- Live transcript preview (last 2-3 segments, scrolling)

**Privacy notice**
- Inline note: raw frames and audio are never logged

---

## 3. OBS Panel

**Connection block**
- Host + Port fields (editable)
- Password field (masked)
- Toggle: Auto-connect on startup
- Button: Connect / Disconnect
- Connection status indicator

**Current state display (when connected)**
- Current scene name
- Stream status: offline / starting / live / stopping
- Recording status: inactive / recording
- Active sources list (chips or small list)

**Events feed**
- Compact list of recent OBS events (scene changes, stream start/stop)

---

## 4. VTube Studio Panel

**Connection block**
- Host + WebSocket Port fields (editable)
- Toggle: Auto-connect on startup
- Button: Connect / Disconnect
- Connection status indicator
- Authentication status (unauthenticated / authenticated)
- Button: Authenticate Plugin (triggers VTS permission popup)

**Current model block (when connected)**
- Current model name
- Last triggered hotkey ID

**Hotkeys list**
- Table: Hotkey Name, Hotkey ID, Type
- Button per row: Trigger (manual test)
- Refresh button to re-fetch hotkeys

---

## 5. Model Provider Panel

**Provider selector**
- Radio group or dropdown: OpenRouter / Self-Hosted / Mock
- Fallback provider selector

**Provider config block (per provider)**

OpenRouter:
- Base URL field (pre-filled, editable)
- API Key field (masked, stored in secret store)
- Model name field (e.g., `anthropic/claude-3-haiku`)
- Supports Vision / Tool Calling / JSON Mode toggles (read-only)

Self-Hosted:
- Base URL field
- API Key field (optional, masked)
- Model name field
- Timeout (ms) field
- Supports Vision / Audio toggles

Mock:
- No editable config
- Label: Mock provider returns fixed test action plans

**Shared config**
- Temperature slider (0.0 to 1.0)
- Max tokens field
- Max context tokens field

**Connection test**
- Button: Test Connection
- Result inline: success / failure with latency or error message

---

## 6. Hotkey Mapper

Maps stream events or conditions to manual VTS hotkey shortcuts.

**Mapping list**
- Each row: Trigger label, VTS Hotkey Name, Cooldown (ms), Remove button
- Button: Add mapping

**Add mapping form**
- Trigger type selector (manual, obs_event, capture_event)
- VTS hotkey selector (dropdown populated from fetched hotkeys)
- Cooldown field

---

## 7. Manual Control Panel

Test and trigger actions directly without running a full pipeline tick.

**VTS hotkey trigger**
- Hotkey selector dropdown
- Button: Trigger Hotkey
- Result: success / error inline

**OBS scene switch**
- Scene name input
- Button: Set Scene
- Result inline

**OBS source visibility**
- Scene name input
- Source name input
- Toggle: Visible / Hidden
- Button: Apply
- Result inline

**Overlay message**
- Message text input
- Display duration field (ms)
- Button: Send Overlay Message

**Log event**
- Level selector: debug / info / warn / error
- Message input
- Button: Log Event

---

## 8. Settings Panel

**Desktop settings**
- Toggle: Start minimized
- Toggle: Minimize to tray
- Toggle: Auto-start on login
- Toggle: Enable local API
- Local API host field
- Local API port field

**Automation settings**
- Toggle: Automation enabled
- Autonomy level selector: paused / suggest_only / auto_safe / auto_full / safe_mode
- Tick interval field (ms)
- Max actions per tick field
- Global action cooldown field (ms)

**Safety settings**
- Toggle: Require confirmation for OBS scene changes
- Toggle: Require confirmation for OBS source visibility
- Toggle: Allow VTS hotkeys without confirmation
- Toggle: Allow overlay messages without confirmation

**Action policy display**
- Allowed actions: editable chip list
- Blocked actions: editable chip list

**Save Settings button**

---

## 9. Log Viewer

**Filter bar**
- Level filter: All / Debug / Info / Warn / Error
- Source filter: All / automation / capture / model / obs / vts / settings / security / renderer
- Text search input
- Button: Clear Logs

**Log table / list**
- Columns: Timestamp, Level (badge), Source (badge), Message
- Expandable row: metadata JSON block
- Auto-scroll toggle (follow latest)
- Row count display

**Color coding (level)**
- debug: muted / gray
- info: default / white
- warn: yellow
- error: red

---

## 10. Setup Wizard (First Run)

Step-by-step screens shown if setup is incomplete.

**Step 1: Welcome**
- App name and brief description
- Button: Get Started

**Step 2: OBS Connection**
- Host, port, password fields
- Button: Test Connection
- Skip option

**Step 3: VTube Studio Connection**
- Host, port fields
- Button: Connect and Authenticate
- Skip option

**Step 4: Model Provider**
- Provider selector
- API key field (if OpenRouter)
- Model name field
- Button: Test Connection
- Skip option

**Step 5: Ready**
- Summary of configured services
- Button: Launch App

---

## State Indicators

Reusable across panels.

| State | Color | Label |
|---|---|---|
| Connected / Success | Green | Connected |
| Disconnected | Gray | Disconnected |
| Connecting | Yellow / Spinner | Connecting... |
| Error | Red | Error |
| Running | Blue / Pulse | Running |
| Paused | Gray | Paused |
| Safe Mode | Orange | Safe Mode |
| Blocked | Orange | Blocked |
| Suggest Only | Purple | Suggest Only |

---

## IPC Actions Mapped to UI

| UI Element | IPC Call |
|---|---|
| Start Automation button | `automation:start` |
| Stop Automation button | `automation:stop` |
| Analyze Now button | `automation:analyze-now` |
| Get automation status | `automation:get-status` |
| Source selector load | `capture:get-sources` |
| Start Camera | `capture:start-camera` |
| Stop Camera | `capture:stop-camera` |
| Start Screen | `capture:start-screen` |
| Stop Screen | `capture:stop-screen` |
| Start Audio | `capture:start-audio` |
| Stop Audio | `capture:stop-audio` |
| Test model connection | `model:test-connection` |
| Set model provider | `model:set-provider` |
| List providers | `model:list-providers` |
| OBS Connect | `obs:connect` |
| OBS Disconnect | `obs:disconnect` |
| OBS Get Status | `obs:get-status` |
| VTS Connect | `vts:connect` |
| VTS Disconnect | `vts:disconnect` |
| VTS Authenticate | `vts:authenticate` |
| VTS Get Hotkeys | `vts:get-hotkeys` |
| VTS Trigger Hotkey | `vts:trigger-hotkey` |
| Load settings | `settings:get` |
| Save settings | `settings:update` |
| List logs | `logs:list` |
| Clear logs | `logs:clear` |
| Live log stream | `logs:event` (IPC event) |
