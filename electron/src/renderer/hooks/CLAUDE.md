# Hooks

Custom React hooks for the renderer application.

## Purpose

Encapsulate data fetching, IPC communication, and validation logic into reusable hooks. These handle the boilerplate of async state management and error handling.

## Key Files

- `useVTS.ts` — Fetches and validates VTS hotkeys via IPC. Returns hotkeys array, loading state, error state, and refetch callback.

## Architecture & Patterns

**useVTS Hook**
- Calls `window.desktop.getHotkeys()` via IPC on mount
- Validates response with Zod schema (`VtsHotkeySchema`)
- Manages three async states: loading, error, success
- Provides `refetch()` callback for manual retry
- Uses `useCallback` to stabilize function references
- Caught errors converted to readable messages

**Validation**
- Zod schema (`VtsHotkeySchema`) defines expected shape: `hotkeyID` (string), `name` (string), `type` (string)
- Parse at runtime to catch malformed IPC responses
- Exported `VtsHotkey` type for typing components

## Dependencies & Integrations

- `react` (useState, useEffect, useCallback)
- `zod` for schema validation
- `window.desktop.getHotkeys()` preload bridge

## Conventions

- Hook names prefixed with `use`
- Return object uses clear property names (hotkeys, loading, error, refetch)
- Schema exported separately from type inference (`VtsHotkey = z.infer<typeof VtsHotkeySchema>`)

## Gotchas & Notes

- Hook re-runs on every component mount because `fetchHotkeys` is in dependency array. This is intentional (fetch on mount), but refetch callback prevents infinite loops.
- Error state preserved separately from hotkeys array (success state doesn't clear on error, only refetch clears it).
- Mock data in VTS IPC handler; real integration will replace the handler in `src/main/ipc/vts.ipc.ts`.
