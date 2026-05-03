# Renderer (React Frontend)

React-based UI for the Electron desktop application. Renders the main window content visible to users.

## Purpose

Provides the user-facing interface for the Beaverhack2026 desktop application. Mounted into the Electron renderer process and compiled with Vite. Communicates with the main process via IPC (inter-process communication) and connects to OBS via WebSocket.

## Key Files

- `main.tsx` — React entry point. Mounts the App component into the `#app` DOM element defined in `index.html` (at electron root).
- `App.tsx` — Root React component. Currently a placeholder React starter template with a logo and link.
- `App.css` — Scoped styles for the App component. Contains flexbox layout and animation keyframes.
- `styles/globals.css` — Global CSS applied to the document body and code elements. Sets system font stacks and font smoothing.
- `logo.svg` — React logo placeholder asset referenced in App.tsx.

## Architecture & Patterns

**React Setup**
- TypeScript with JSX enabled (`jsx: "react-jsx"`)
- React 19.2.5 and React-DOM 19.2.5
- No framework beyond React (no Next.js, no router yet)
- Strict mode enabled during development

**Build & Bundling**
- Vite (v7.3.2) with `@vitejs/plugin-react` for fast HMR
- Electron-vite wrapper for integration with Electron main/preload processes
- TypeScript compilation targets ES2022, module resolution is "Bundler"
- Build output goes to `dist/renderer`

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

**No Integrations Yet**
- No state management library (Redux, Zustand, etc.)
- No UI component library (Material-UI, Shadcn, etc.)
- No routing (React Router, TanStack Router)
- No form handling library

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
- CSS Modules not used; global and component-scoped CSS files
- Flexbox for layout

## Gotchas & Notes

**Current State**
- This is a placeholder React app scaffolded from a create-react-app template
- All content in App.tsx is boilerplate; the actual app UI has not been built yet
- No components beyond App exist currently

**Integration Pending**
- Preload script exists (`src/main/preload/index.js`) but not yet utilized in renderer
- IPC handlers registered in main process (`src/main/ipc`) but no consumers in renderer
- OBS connection logic lives in main process; renderer will need to trigger or subscribe to OBS events via IPC

**Architecture Notes**
- The renderer is designed to be a sandboxed process (contextIsolation: true, nodeIntegration: false)
- Any backend work (OBS, file system, etc.) must be mediated by main process via IPC
- Environment variable `ELECTRON_RENDERER_URL` switches between dev server (local) and bundled mode (production)

## Subdirectories

- `styles/` — Global CSS stylesheets applied to the entire renderer
