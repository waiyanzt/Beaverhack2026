# Beaverhack2026

A desktop background agent that observes local streaming context and intelligently controls local streaming tools using AI-powered action planning.

## Overview

Beaverhack2026 runs as a background desktop app that captures your streaming environment (camera, screen, audio), sends structured observations to a language model, receives an action plan, validates it for safety, and executes approved actions through OBS and VTube Studio.

**Primary workflow:**
```
Capture inputs → Build observation → Call model → Parse action plan → Validate actions → Execute local actions
```

## Key Features

- **Multi-source capture**: Camera frames, screen/window capture, and audio transcription
- **Model-agnostic**: Supports OpenRouter, self-hosted OpenAI-compatible models, and mock providers
- **Action automation**: VTube Studio hotkey triggers, parameter adjustments, OBS scene/source control, overlay messages
- **Safety by default**: Action validation, cooldowns, autonomy levels, and confirmation gates
- **Local control**: OBS WebSocket and VTube Studio API integration
- **Structured logging**: Full pipeline visibility and debugging
- **Settings UI**: Configure capture sources, model providers, safety policies, and hotkey mappings

## Architecture

The app is built as an Electron desktop application with a clear separation of concerns:

- **Main Process**: Core logic, external API calls, IPC handlers, service layer
- **Renderer**: React UI for setup, status, controls, and logs
- **Hidden Capture Window**: Browser media APIs for frame/audio sampling
- **Services**: Modular services for OBS, VTube Studio, capture orchestration, and model routing

## Tech Stack

- **Electron** for cross-platform desktop app
- **React** for UI
- **TypeScript** for type safety
- **Vite** for fast builds
- **Zod** for data validation
- **OBS WebSocket JS** for OBS integration
- **WebSocket (ws)** for VTube Studio connection

## Getting Started

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

This starts Vite dev server and Electron app.

### Build

```bash
pnpm build
pnpm build:electron
```

## Project Structure

```
beaverhack2026/
├── electron/                    # Main Electron app
│   ├── src/
│   │   ├── main/               # Main process & services
│   │   ├── renderer/           # React UI
│   │   ├── preload/            # Secure IPC bridge
│   │   └── shared/             # Schemas & types
│   └── ...
├── apps/                        # Future additional apps
├── packages/                    # Shared packages
├── docs/                        # Architecture & setup docs
├── models/                      # Prompts & provider config
└── scripts/                     # Build & dev scripts
```

## Configuration

The app uses a JSON config file (created on first run) with sensible defaults. Key settings:

- **Model provider**: OpenRouter, self-hosted, or mock
- **Capture**: Camera/screen FPS, resolution, audio sample rate
- **Automation**: Tick interval, max actions per tick, autonomy level
- **Safety**: Confirmation gates for scene changes and source visibility
- **OBS & VTS**: WebSocket endpoints and credentials

See [SPEC.md](./SPEC.md) for full data contracts, service interfaces, and implementation details.

## Minimum Demo

The app demonstrates a complete loop with:

1. Connect to OBS and VTube Studio
2. Configure a model provider
3. Click "Analyze Now"
4. App captures OBS/VTS state and optional text
5. Model generates action plan
6. App validates and executes actions
7. View full results in logs

## Documentation

- [SPEC.md](./SPEC.md) — Complete technical specification, data contracts, service interfaces
- [docs/architecture.md](./docs/architecture.md) — System design & component interactions
- [docs/security.md](./docs/security.md) — Security model & secret handling
- [docs/setup.md](./docs/setup.md) — Detailed setup instructions

## License

Private project.
