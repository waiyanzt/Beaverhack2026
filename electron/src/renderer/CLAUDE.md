# Renderer (React Frontend)

React-based UI for the Electron desktop application. Renders the main window content visible to users.

## Purpose

Provides the user-facing interface for the AuTuber desktop application. Mounted into the Electron renderer process and compiled with Vite. Communicates with the main process via IPC (inter-process communication) and connects to OBS via WebSocket.

## Key Files

- `main.tsx` — React entry point. Mounts the App component into the `#app` DOM element defined in `index.html` (at electron root).
- `App.tsx` — Root component with tab-bar shell. Defaults to Hotkey Mapper tab. Displays placeholder "coming soon" for other tabs (Status, Capture, OBS, VTube Studio, Model, Settings, Logs).
- `components/HotkeyMapper.tsx` — VTS hotkey-to-trigger mapping UI. Includes mapping list with add/remove, inline form with trigger type, hotkey selection, and cooldown config. Uses `useVTS` hook to load VTS hotkeys.
- `hooks/useVTS.ts` — Custom hook for fetching and validating VTS hotkeys via IPC. Zod-validated schema, loading/error states, refetch capability.
- `types/electron-api.d.ts` — TypeScript declaration for `window.desktop` preload API.
- `styles/globals.css` — Global CSS applied to the document body and code elements. Sets system font stacks and font smoothing.

## Architecture & Patterns

**React Setup**
- TypeScript with JSX enabled (`jsx: "react-jsx"`)
- React 19.2.5 and React-DOM 19.2.5
- Tab-based shell in App.tsx (8 tabs: Status, Capture, OBS, VTube Studio, Model, Hotkey Mapper, Settings, Logs)
- No framework beyond React (no Next.js, no router yet)
- Strict mode enabled during development

**Build & Bundling**
- Vite (v7.3.2) with `@vitejs/plugin-react` for fast HMR
- Electron-vite wrapper for integration with Electron main/preload processes
- TypeScript compilation targets ES2022, module resolution is "Bundler"
- Build output goes to `dist/renderer`

**Component Structure**
- App.tsx: root tab shell, manages active tab state, renders HotkeyMapper when selected
- HotkeyMapper: full-featured mapping UI with form state, list rendering, delete/refetch actions
- useVTS hook: encapsulates IPC call, Zod validation, loading/error lifecycle

**Styling Approach**
- Tailwind CSS utility classes throughout (no CSS files for new components)
- Responsive design with flex layout for tab bar and content areas
- Loading skeleton with pulse animation for async data
- Error states with retry buttons (icon + text)
- Form inputs with focus rings and consistent styling

**HTML Entry Point**
- HTML file resides at `/electron/index.html` (not in renderer directory)
- Script tag references `/src/renderer/main.tsx` as module entry
- Single DOM target: `<main id="app"></main>`

## Dependencies & Integrations

**React Ecosystem**
- `react` (v19.2.5)
- `react-dom` (v19.2.5)

**Build Tools**
- `@vitejs/plugin-react` (v5.2.0)
- `vite` (v7.3.2)

**Electron Integration**
- Loaded by `createMainWindow()` in `src/main/windows/main-window.ts`
- Can receive IPC messages from main process via preload script
- Will eventually connect to OBS Studio via WebSocket (architecture in main process)

**New Integrations**
- `zod` for runtime validation of IPC responses
- `lucide-react` for icons (Trash2, RefreshCw, Plus)
- IPC bridge via `window.desktop.getHotkeys()` for VTS hotkey fetching

**No Integrations Yet**
- No state management library (Redux, Zustand, etc.)
- No UI component library (Material-UI, Shadcn, etc.)
- No routing (React Router, TanStack Router)
- No form handling library beyond basic React state

## Conventions

**File Structure**
- Component files use `.tsx` extension
- Styles are co-located with components (e.g., App.tsx next to App.css)
- Global styles in `styles/` subdirectory
- Assets (logo, icons) stored at root level of renderer

**Component Naming**
- Default exports for root/main components (App)
- PascalCase for component filenames

**Styling**
- Tailwind CSS utility classes (primary approach for new components)
- Older components may use co-located CSS files (App.css, globals.css)
- No CSS Modules
- Flex layout for responsive UI

## Gotchas & Notes

**Current Implementation Status**
- App.tsx is now a functional tab shell with Hotkey Mapper as the first complete feature
- HotkeyMapper component is fully functional: displays VTS hotkeys, allows adding/removing mappings, validates Zod schema
- Hotkey mappings are stored in local component state only (not persisted to backend yet)
- Other 7 tabs show "coming soon" placeholder

**IPC Integration**
- Preload bridge (`window.desktop.getHotkeys()`) is wired and working
- Main process returns mock hotkeys from VTS IPC handler (`vts.ipc.ts`)
- All IPC calls validated with Zod at runtime (VtsHotkeySchema)
- useVTS hook handles loading, error, and success states

**Known Limitations**
- Hotkey mappings live in local component state; no persistence to settings backend yet
- Mock data returned from VTS IPC handler; actual VTubeStudio client integration pending
- Other 7 tabs (Status, Capture, OBS, etc.) not yet implemented

**Architecture Notes**
- The renderer is designed to be a sandboxed process (contextIsolation: true, nodeIntegration: false)
- Any backend work (OBS, file system, etc.) must be mediated by main process via IPC
- Environment variable `ELECTRON_RENDERER_URL` switches between dev server (local) and bundled mode (production)

## Subdirectories

- `styles/` — Global CSS stylesheets applied to the entire renderer
- `components/` — React components (HotkeyMapper, and future tabs/panels)
- `hooks/` — Custom React hooks (useVTS for IPC data fetching, Zod validation)
- `types/` — TypeScript type declarations and interfaces (electron-api.d.ts)

---

## Standards (from AGENTS.md)

### Architecture Boundaries

The renderer owns: setup UI, status UI, controls, logs, and user interaction only.

Renderer code must NOT import:
- Electron main-process services
- Node-only packages
- secret storage helpers
- OBS/VTS clients directly
- model provider clients directly
- filesystem APIs
- modules that transitively depend on privileged APIs

All renderer-to-main communication goes through the typed preload IPC API only.

### Security Requirements

Renderer windows must use secure defaults:

```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: path.join(__dirname, "preload.js"),
}
```

Renderer must never access: model API keys, OBS passwords, VTube Studio auth tokens, local API bearer tokens, raw secret-store values, or Node.js/filesystem APIs directly.

### Loading States

Every user-facing view that can suspend, wait for IPC data, load settings, or depend on external connection state needs an appropriate loading skeleton or state. This applies to:

- setup flow
- settings panel
- status panel
- capture panel
- model provider panel
- OBS/VTS connection panels
- logs viewer
- manual control panel

Update loading skeletons whenever the layout of a panel or view changes.

### TypeScript And Code Style

- TypeScript, strict typing, two-space indentation, semicolons
- `React.JSX.Element` for component return types
- `unknown` instead of `any` for untrusted data
- Zod validation at runtime boundaries (IPC responses, external payloads)
- `try/catch` around async IPC calls
- No hardcoded secrets, no commented-out dead code, no vague TODOs

### IPC Usage

IPC channel names follow `domain:operation` format (e.g. `obs:connect`, `settings:update`).

Never send raw errors or secrets through IPC. Validate all IPC response shapes before use. All trust boundaries must use runtime validation.

### Quality Bar

Every renderer feature must include:
- OBS/VTS connection state visibility
- automation start/stop controls
- model-generated action log viewer
- actionable error messages (not raw stack traces)
- loading states for all async views
- settings UI for any user-configurable behavior

### Definition Of Done

A renderer change is complete only when:
- Code compiles with no type errors
- Loading states exist for affected views
- IPC response shapes are validated at runtime
- Errors are handled and presented as actionable messages
- Secrets are not accessed or exposed
- Architecture boundaries are preserved (no privileged imports)
