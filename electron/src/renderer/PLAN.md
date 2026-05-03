# Plan: Hotkey Mapper Panel (Goal 6)

## Overview
Build the Hotkey Mapper panel: a UI for creating and managing mappings from trigger types (manual, obs_event, capture_event) to VTube Studio hotkeys, with configurable cooldowns. Fetches available VTS hotkeys via IPC and persists mappings in local component state.

## Tasks

### Task 1: Implement useVTS hook
**Status**: done
**Goal**: Provide a React hook that fetches VTube Studio hotkeys via IPC and exposes them along with loading/error state.
**Depends on**: none
**Details**:
- File: `src/renderer/hooks/useVTS.ts`
- Calls `window.electronAPI.invoke('vts:get-hotkeys')` to fetch hotkeys on mount
- Returns `{ hotkeys, loading, error, refetch }`
- Each hotkey has at minimum: `hotkeyID: string`, `name: string`, `type: string`
- Use Zod to validate the IPC response shape
- Handle errors gracefully; expose error as a string message
- The preload exposes IPC as `window.electronAPI.invoke(channel, ...args)` - check electron-api.d.ts and expand it if needed to include this method signature

### Task 2: Implement HotkeyMapper component
**Status**: pending
**Goal**: Build the full Hotkey Mapper UI with a mapping list and an add-mapping inline form.
**Depends on**: Task 1
**Details**:
- File: `src/renderer/components/HotkeyMapper.tsx`
- Uses the `useVTS` hook from Task 1 for the hotkey dropdown
- **Mapping list**: table/list where each row shows Trigger label, VTS Hotkey Name, Cooldown (ms), and a Remove button
- **Add mapping button**: opens an inline form below the list (not a modal)
- **Add mapping form fields**:
  - Trigger type selector: `<select>` with options manual, obs_event, capture_event
  - VTS hotkey selector: `<select>` populated from `useVTS` hotkeys (shows name, value is hotkeyID)
  - Cooldown field: number input (ms), default 0
  - Save button and Cancel button
- Mappings stored in local `useState` as an array
- Style strictly per frontend-values.md: slate palette, bg-white cards, rounded-xl, shadow-sm, text-sm, blue for primary actions, rose for destructive (remove), emerald for success states
- Loading skeleton while hotkeys are fetching
- Error message if hotkeys fetch fails (actionable: "Could not load hotkeys. Check VTube Studio connection.")
- No hardcoded secrets, no direct IPC imports (use window.electronAPI only)

### Task 3: Integrate HotkeyMapper into App.tsx
**Status**: pending
**Goal**: Replace the placeholder App.tsx with a tab-navigated shell that shows the HotkeyMapper panel as the active tab.
**Depends on**: Task 2
**Details**:
- File: `src/renderer/App.tsx`
- Remove boilerplate (logo, link, App.css import)
- Add a minimal tab bar with at least: Status, Hotkey Mapper (more tabs can be stubs)
- Default active tab: Hotkey Mapper
- Other tabs can render a `<div className="...">Coming soon</div>` placeholder
- Shell uses bg-slate-50, full viewport height, tab bar at top with border-b border-slate-200
- Active tab indicator: blue underline or bg-white with shadow
- App.css can be left as-is or emptied; do not delete the file
