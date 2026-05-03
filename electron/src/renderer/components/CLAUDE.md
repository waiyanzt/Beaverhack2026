# Components

React components for the renderer application UI.

## Purpose

Provide self-contained, reusable UI building blocks for the application interface. Each component manages its own layout, styling, state, and interactions.

## Key Files

- `HotkeyMapper.tsx` — Full-featured VTS hotkey mapping UI with form, list, and actions.

## Architecture & Patterns

**HotkeyMapper Component**
- Fetches VTS hotkeys via `useVTS` hook on mount
- Maintains local state for mappings (array) and add form visibility
- Form state includes triggerType, hotkeyID, cooldownMs
- Two-part UI: form (when showing) and mapping list
- Form disabled/loading state based on hook state (loading skeleton or retry button)
- Supports add, remove, and cancel actions
- Delete button has Trash2 icon; Add button has Plus icon; Retry has RefreshCw icon

**UI States**
- Form collapsed (hidden by default)
- Form expanded with loading skeleton for hotkey selector
- Form expanded with error message and retry button
- Form expanded with populated hotkey dropdown
- Empty list state with "No mappings yet" message
- Populated list with mapping rows and delete buttons

**Styling**
- Tailwind CSS throughout
- Color scheme: slate grays (primary), blue (active/interactive), emerald/rose for status colors
- 8px spacing base unit (px-3 py-1.5 = 12px vertical, 8px horizontal)
- Rounded corners: md for inputs, lg for buttons, xl for card wrapper
- Icons 16px for actions, 14px for small inline icons

## Dependencies & Integrations

- `react` (useState, useCallback)
- `useVTS` hook for hotkey data and lifecycle
- `lucide-react` for icons (Trash2, RefreshCw, Plus)
- `window.desktop.getHotkeys()` indirectly via hook

## Conventions

- Component uses `React.JSX.Element` return type
- Form data held in local state object with type hints
- Mapping list items keyed by UUID
- Badge styling function extracted as `getTriggerBadgeColor()`
- Form submission disabled when hotkeyID is empty

## Gotchas & Notes

- Hotkey mappings stored in local component state only (not persisted). Next steps: add IPC channel to save/load mappings from settings backend.
- Form reset on cancel and successful submit preserves UX consistency.
- Cooldown input uses `Math.max(0, ...)` to prevent negative values.
- Loading skeleton shows 3 placeholder bars while fetching hotkeys.
- Error retry button triggers `refetch()` from hook, which re-runs IPC call.
