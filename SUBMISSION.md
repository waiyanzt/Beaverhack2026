# AuTuber: Nemotron-Powered Real-Time Stream Controller

## One-Liner

AuTuber is a Nemotron-powered desktop stream controller that observes live creator context and safely triggers VTube Studio, OBS, overlay, and future stream actions through validated tool calls.

## Inspiration

Most AI streaming tools are chatbots. They can talk to the creator, summarize chat, or generate captions, but they usually do not operate the actual stream.

We wanted to build something more useful for VTubers and livestream creators: an AI sidekick that can watch the moment, understand what is happening, and help the stream setup react automatically.

Streaming is already a lot to manage. A creator may be talking, reacting, checking chat, changing scenes, managing overlays, and triggering avatar expressions at the same time. AuTuber gives the creator an extra pair of paws on the control panel.

## What It Does

AuTuber is a local Electron desktop app that connects AI reasoning to real streaming tools.

The current system can:

- connect to VTube Studio
- authenticate with the VTube Studio API
- read available VTube Studio hotkeys
- trigger approved avatar reactions
- connect to OBS
- read OBS state
- capture camera, screen, and audio context
- send structured stream observations to a configured model provider
- parse model responses into typed action plans
- validate every action against local policy
- enforce cooldowns to prevent reaction spam
- log executed, blocked, and failed actions

In the demo, AuTuber can observe the stream context and trigger avatar reactions such as surprise, anger, crying, or other VTube Studio hotkeys. It can also reason about OBS state and prepare stream-production actions such as overlays or scene/source updates, with safer OBS actions kept behind validation and confirmation rules.

## Product Vision

AuTuber is designed to become a full AI stream-control layer:

```text
Camera + Screen + Audio + Twitch/YouTube Chat
  -> AI understands the stream moment
  -> AuTuber validates the action
  -> OBS, VTube Studio, overlays, alerts, and sound react safely
```

The long-term goal is not only avatar emotes. The goal is a safe local AI controller for the whole creator production environment.

## Best Use of Nemotron

Nemotron is the reasoning core of AuTuber.

We are not using Nemotron as a normal chatbot. We use it as a multimodal stream director inside a tool-control loop:

```text
Observe -> Reason -> Plan -> Validate -> Act
```

AuTuber gives Nemotron structured context, such as:

* camera frames
* screen context
* audio/transcription context
* OBS state
* VTube Studio state
* available VTube Studio hotkeys
* recent action history
* cooldown state
* autonomy level
* allowed and blocked actions

Nemotron then proposes a structured action plan. AuTuber parses and validates that plan before anything runs.

This means Nemotron does not just generate text. It chooses controlled stream actions.

## What Makes It Different

A chatbot produces text.

AuTuber produces validated local stream actions.

That is the key difference. The model is not given unrestricted desktop control. Instead, AuTuber exposes a controlled tool layer, similar to an MCP-style controller, where the model can request actions like:

* trigger a VTube Studio hotkey
* show an overlay message
* log an event
* suggest an OBS scene/source action
* do nothing if no action is needed

Every requested action goes through local validation before execution. This makes AuTuber safer and more practical than a direct “AI controls my computer” demo.

## Latency-Aware Architecture

Live streaming does not wait for slow AI.

A response that arrives after 10 seconds may still be impressive, but it is too late for a facial reaction, chat moment, avatar expression, or OBS production cue.

One of our biggest technical focuses was optimizing the system for live latency. Instead of forcing every decision through one giant model request, AuTuber can split work into multiple focused model loops:

```text
Shared Observation State
  -> Fast Reaction Loop
  -> Audio/Transcript Loop
  -> Screen/OBS Loop
  -> Long-Context Director Loop
  -> Action Validator
  -> Approved Stream Action
```

This lets small, time-sensitive tasks stay fast while deeper context can still be processed separately.

For example:

* a fast visual loop can detect a simple expression or streamer presence
* an audio/transcript loop can understand what was just said
* a screen/OBS loop can reason about production state
* a director loop can use longer context for broader stream decisions

All loops still produce structured action plans, and all actions still pass through the same validator.

In our optimized demo branch, focused model requests reached roughly **600 ms response time** on a normal internet connection of about **75 Mbps down / 70 Mbps up**. Actual latency depends on the model provider, hardware, network, prompt size, media size, and capture settings, but the architecture is designed to keep fast reactions fast instead of making every action wait for the slowest request.

## Safety Model

AuTuber is built around one rule:

```text
The AI suggests. AuTuber validates. The creator stays in control.
```

Before any model-generated action runs, AuTuber checks:

* whether the action has the correct structure
* whether the action type is allowed
* whether the action is blocked by policy
* whether the hotkey, scene, or source exists
* whether the action was triggered too recently
* whether the current autonomy level allows it
* whether the action requires confirmation

Safe actions, such as VTube Studio expressions or log events, can run automatically. Riskier actions, such as OBS scene changes or source visibility changes, can require confirmation.

This prevents the model from spamming expressions, switching scenes unexpectedly, or running arbitrary commands.

## How We Built It

AuTuber is built with:

* Electron
* TypeScript
* React
* Node.js
* VTube Studio API
* OBS WebSocket
* OpenAI-compatible model APIs
* local camera/audio/screen capture
* structured action-plan validation
* NVIDIA Nemotron 3 Nano Omni experimentation
* LM Studio/self-hosted inference experimentation
* remote H200 inference experimentation

The app is split into clear services:

* capture service
* observation builder
* prompt builder
* model router
* action-plan parser
* action validator
* action executor
* OBS service
* VTube Studio service
* logger
* renderer UI

The core runtime flow is:

```text
Capture Context
  -> Build Observation
  -> Ask Model
  -> Parse Action Plan
  -> Validate Safety
  -> Execute Approved Action
  -> Log Result
```

## Challenges

### Latency

Our original approach tried richer video input, but full video context was too slow for live reactions. We redesigned the system around single-frame visual input, structured context, and focused model requests.

### Model Output Reliability

We saw occasional JSON and formatting issues from model responses. Instead of trusting raw model output, we built structured action-plan parsing and validation so invalid responses are blocked safely.

### Dynamic VTube Studio Hotkeys

VTube Studio hotkeys depend on the loaded model. Hardcoding actions is fragile, so AuTuber reads the available hotkey list and uses that as the action catalog.

### Safe OBS Automation

OBS actions can affect the whole stream, so we made OBS automation conservative by default. OBS state can be read and used for reasoning, while production-impacting actions remain policy-controlled.

## What We Are Proud Of

We are proud that AuTuber is not just a chatbot wrapper.

It is a real local agent architecture:

* it observes live context
* it reasons with Nemotron
* it creates structured action plans
* it validates safety locally
* it controls real creator tools
* it logs what happened

We are also proud of the latency work. Getting focused model responses down to roughly 600 ms in optimized demo conditions made the system feel much closer to a real stream assistant instead of a slow offline analysis tool.

## What We Learned

We learned that useful AI agents need much more than a model call.

A practical stream-control agent needs structured observations, latency-aware model routing, fast and deep reasoning loops, typed action plans, runtime validation, cooldowns, safe defaults, user controls, logs, and failure handling.

Nemotron gave us the reasoning layer, but AuTuber is the system that turns reasoning into safe, useful stream actions.

## What Is Next

Next, we want to add:

* Twitch and YouTube chat ingestion
* richer OBS scene/source automation UI
* OBS alerts and overlay helpers
* soundboard/audio cue actions
* better automatic hotkey intent mapping
* configurable fast-loop and director-loop routing
* formal latency benchmarking across providers
* smoother first-time setup
* packaged releases for non-technical creators
* richer approval and review workflows
* stream-safe automation presets

## Summary

AuTuber turns Nemotron into a real-time AI stream director.

It observes camera, screen, audio, OBS, and VTube Studio context; splits reasoning into fast focused model loops and deeper context loops; creates structured action plans; validates every action locally; and safely controls creator tools like VTube Studio, OBS, overlays, and future stream actions.

Our project uses Nemotron not as a chatbot, but as the brain of a latency-aware, multimodal, tool-using desktop agent for livestream creators.
