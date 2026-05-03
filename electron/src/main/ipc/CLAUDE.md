# IPC Handlers

Main process IPC request handlers for inter-process communication with renderer.

## Purpose

Handle asynchronous requests from the renderer process. Each handler is responsible for one domain of functionality (model, vts, app, etc.) and returns structured responses to the renderer.

## Key Files

- `index.ts` — Main IPC handler registration. Registers all domain handlers including app version, model management, and VTS handlers.
- `vts.ipc.ts` — VTube Studio-specific handlers. Fetches hotkeys (currently mock data).

## Architecture & Patterns

**Handler Registration**
- `registerIpcHandlers()` called at main process startup
- Each domain (model, vts) has its own handler registration function
- All error handling wrapped in try-catch; errors logged and safe default returned

**Response Format**
- Invoke handlers return data directly (not wrapped in {ok, data} object)
- Model handlers return arrays or {ok, message} objects for clarity
- Errors caught and converted to safe defaults (e.g., empty array, "unknown" version)

**VTS Handler**
- `registerVtsIpcHandlers()` registers `vts:get-hotkeys` handler
- Returns array of hotkey objects: {hotkeyID, name, type}
- Currently returns mock data for testing
- Production version will call VTubeStudio client API

**Model Handler**
- Uses `ModelRouterService` to test connections
- Manages model provider selection and listing
- `ModelSetProvider` validates provider ID before storing

## Dependencies & Integrations

- `electron.ipcMain` for registering handlers
- `ModelRouterService` for model provider logic
- `model-provider-store` for persistence
- Model providers (OpenAI-compatible, OpenRouter, vLLM)

## Conventions

- Handler names follow domain naming (registerVtsIpcHandlers, registerModelHandlers implicit in index.ts)
- All handlers wrapped in try-catch with error logging
- Handler paths: `src/main/ipc/{domain}.ipc.ts` or inline in index.ts for simple handlers

## Gotchas & Notes

- Mock data in vts.ipc.ts is placeholder; production will call real VTubeStudio API
- Model handlers rely on stored provider configuration in localStorage-like store
- OpenAICompatibleProvider uses fetch() directly; no axios or external HTTP library
- New IPC handlers should be added as separate handler file if more than 3-4 lines
