# AuTuber - AI VTuber Automation

## Tagline

Let your avatar react, emote, and manage the stream while you focus on creating.

## Inspiration

VTubing gives creators a way to perform through expressive digital avatars, but running a live stream is still a lot of work. A VTuber often has to entertain viewers, talk to chat, react to gameplay, manage OBS scenes, trigger avatar expressions, monitor audio/video, and keep the stream feeling alive all at the same time.

That creates a strange problem: the more expressive a VTuber setup becomes, the more buttons, hotkeys, overlays, and production tasks the creator has to manage manually.

We wanted to build something that works beside the creator like an AI stagehand. Not a chatbot. Not a replacement for the streamer. A real local assistant that watches the live moment, understands what is happening, and helps the avatar respond naturally.

That became AuTuber: an AI-powered VTuber automation system that turns live camera, audio, OBS, and VTube Studio context into safe, real-time stream actions.

## What It Does

AuTuber is a local desktop copilot for VTubers. It observes the creator’s live streaming context, asks an AI model what reaction or stream action makes sense, validates that decision, and then safely executes approved actions through OBS and VTube Studio.

A creator uses AuTuber by launching it alongside OBS and VTube Studio, connecting their local tools, choosing a model provider, and starting the live automation loop. Once running, AuTuber can detect stream cues such as surprise, excitement, sadness, absence, or other custom creator-defined labels, then map those cues to avatar hotkeys or local stream behaviors.

The core experience is:

1. AuTuber watches the current live context.
2. The model detects what is happening.
3. The app validates the model’s decision.
4. Safe actions are executed locally.
5. The creator can review what happened through logs and status panels.

Current features include:

- Real-time VTuber reaction automation.
- VTube Studio connection, authentication, hotkey fetching, and hotkey triggering.
- OBS state awareness and configurable AFK overlay handling.
- Camera, microphone, and stream-context capture.
- AI cue detection from live visual/audio context.
- Local cue-label mapping so the model does not directly choose raw hotkey IDs.
- Action validation with allowlists, blocked actions, cooldowns, and safety checks.
- Manual controls for testing connections and hotkeys before going live.
- Logs and diagnostics so creators can see what the AI detected, what was blocked, and what was executed.
- Provider flexibility for cloud, local, and OpenAI-compatible models.

One of the most exciting behaviors we discovered was accidental: during testing, the model recognized a peace sign as “peace out” without us explicitly prompting it to do so. It treated the gesture as a signal that the streamer was leaving and activated AFK mode. What first looked like a bug became one of the most interesting feature directions: natural gesture-based stream control.

## How We Built It

We built AuTuber as a local Electron desktop application using TypeScript, React, Vite, and a strongly typed main/renderer architecture.

The app is split into four major layers:

- Electron main process: owns privileged behavior such as OBS/VTube Studio connections, model calls, settings, secrets, validation, and action execution.
- Electron renderer: owns the user interface, including setup, status, capture controls, model settings, logs, and manual testing.
- Preload IPC bridge: exposes a limited typed API between the renderer and main process.
- Hidden capture window: uses browser media APIs for camera, microphone, and screen/window capture.

The automation pipeline follows a safety-first flow:

1. Capture local context from camera, audio/transcript, OBS, VTube Studio, and recent actions.
2. Build a structured observation.
3. Send the observation to the selected model provider.
4. Receive a structured action plan.
5. Parse and normalize the response.
6. Validate actions against schema, cooldowns, allowed actions, blocked actions, and autonomy level.
7. Resolve cue labels to local VTube Studio or AFK actions.
8. Execute approved actions only through local services.
9. Log the full result for review.

We integrated with OBS through OBS WebSocket and with VTube Studio through the VTube Studio WebSocket API. For model providers, we designed the system around OpenAI-compatible request shapes so AuTuber can support local models, cloud models, and mock providers during development.

A major design decision was that the AI model never directly controls the stream. The model detects cues and proposes intent, but the Electron app owns the final decision. This prevents stale hotkeys, malformed JSON, unsafe OBS changes, or hallucinated actions from breaking a live stream.

We also built a VTube Studio catalog layer because every VTuber model can have different hotkeys. Instead of hardcoding reactions, AuTuber reads the current model’s hotkeys, classifies them, lets the operator override mappings, and resolves active cue labels to the current safe automation actions.

## Challenges We Ran Into

The hardest part was that AuTuber is not just an AI app. It is a real-time desktop automation system touching Electron, camera capture, microphone capture, model providers, OBS, VTube Studio, settings, IPC, validation, logging, and live UI state. A small issue in any layer could break the whole experience.

Early on, we had to stabilize the Electron app itself. The repository structure, Vite configuration, TypeScript setup, renderer entrypoint, production paths, and environment variables all needed cleanup before the AI loop could even run reliably.

Media capture was another major challenge. Camera, screen, and audio capture behave differently across platforms and permission systems. We ran into screen capture backend errors, microphone levels staying flat, unreliable MP4 exports, heavy preview polling, and media files that needed normalization before they could be sent to a model. We moved more capture/export work into the Electron main process and added clearer UI feedback so operators could actually understand what was happening.

Model provider support was surprisingly inconsistent. Some providers exposed an OpenAI-compatible API but rejected certain multimodal payloads such as raw video, audio files, or non-image media. We had to separate “the media sample is valid” from “this provider supports that media shape.” That led us toward a more reliable frame/image-based visual pipeline with separate transcript or audio-provider support.

Model output reliability was also a big problem. The model sometimes returned malformed JSON, truncated tool calls, empty action arrays, or noisy noop actions with extra fields. Since AuTuber controls real local tools, we could not trust raw model output. We added schema validation, action normalization, fallback noop plans, confidence thresholds, cooldowns, allowlists, and blocked-action handling.

Latency and accuracy pulled against each other. When we made reactions faster by using the latest frame instead of waiting for longer clips, reactions felt more immediate but became more prone to weak detections. For example, heart-eye reactions could trigger from a normal smile, or shock could trigger from a neutral expression. We added stricter evidence gates and shifted the model’s job from “choose a hotkey” to “detect a cue.”

That cue-label redesign became one of the most important breakthroughs. At first, the model saw raw VTube Studio hotkeys, catalog IDs, and implementation details. That made the system fragile because the model could choose stale or invalid identifiers. We changed the architecture so the model only outputs cue labels, while the Electron app deterministically maps those cue labels to the current safe local actions.

OBS automation required an even stricter boundary. For AFK or vacant-camera detection, we wanted the stream to show an overlay, but we did not want the model directly toggling OBS sources. We built a local AFK overlay service so the model can emit a vacant cue, while the app owns the OBS scene/source selection, debounce timing, validation, and diagnostics.

One of our favorite surprises was the peace sign discovery. The model recognized a peace sign as “peace out” without explicit prompting and activated AFK mode. At first, we thought something had gone wrong. Then we realized it was actually a feature hiding inside the bug: AuTuber could support natural visual stream commands where creators gesture to their camera instead of pressing buttons.

The biggest challenge overall was balancing speed, accuracy, and safety. A VTuber reaction has to happen quickly, but a live automation tool also has to be predictable. AuTuber became much stronger when we treated the model as a perception layer and kept final execution inside a validated local automation system.

## Accomplishments That We Are Proud Of

We are proud that AuTuber is more than a chatbot. It is an AI system that observes real streaming context and performs real local actions.

The most important accomplishment is the working automation loop: capture context, call a model, parse an action plan, validate it, resolve it locally, execute a VTube Studio or AFK action, and log the result. That proves the core idea works.

We are also proud of the safety-first architecture. Live streaming tools are powerful, and giving AI access to them can be risky. By making the model propose cue labels instead of directly controlling OBS or VTube Studio, we built a system that is much easier to inspect, debug, and trust.

The VTube Studio catalog is another major win. Every VTuber model has different hotkeys, so a useful assistant has to adapt to the creator’s actual setup. AuTuber can inspect available hotkeys, classify them, let the user override mappings, and keep stale hotkeys from leaking into live automation.

We are especially excited about the accidental peace-sign behavior. The model’s ability to interpret a natural gesture as creator intent made AuTuber feel less like a rigid automation script and more like a real assistant that can understand the performer.

We are also proud that the idea is transferable. We built AuTuber for VTubers, but the same architecture could support livestreamers, esports productions, classrooms, podcasts, online performances, and event broadcasts. Anywhere a human is presenting live, an AI stagehand could help manage the production layer.

## What We Learned

We learned that building an AI agent for a real desktop workflow is very different from building a normal AI chat app. The hard part is not only getting the model to understand a situation; it is safely connecting that understanding to real software actions.

We learned that multimodal support is provider-specific. A model being available through a familiar API does not mean it supports every image, video, or audio format. Real products need provider capability detection, fallbacks, and clear operator warnings.

We learned that prompt engineering alone is not enough. For live automation, the product needs deterministic validation, confidence thresholds, cooldowns, action allowlists, blocked actions, safe defaults, and structured logs.

We learned that the model should not be responsible for implementation details. It should not need to know raw VTube Studio hotkey IDs or OBS source names. The model is best at perception and intent; the app is best at state, validation, mapping, and execution.

We also learned that user control is part of product quality. If an automation system is difficult to inspect, configure, or override, it is not ready for real creators. Logs, settings, status panels, manual tests, and diagnostics are not extras. They are what make AI automation usable.

Most importantly, we learned that the best version of AuTuber is not an AI replacing the streamer. It is an AI helping the streamer stay in character, stay expressive, and stay focused on the live moment.

## What Is Next

After the hackathon, we want to turn AuTuber from a working prototype into a creator-ready live-production assistant.

The next step is to improve the setup experience. A new user should be guided through connecting OBS, connecting VTube Studio, selecting a model provider, choosing capture devices, testing hotkeys, and enabling safe automation profiles.

We also want to expand natural gesture controls. The accidental peace-sign discovery showed that creators could use simple visual commands such as waving, peace signs, covering the camera, thumbs up, or leaning away to trigger stream states. That could make AuTuber feel much more natural than a hotkey-heavy workflow.

We want to improve model-provider capability detection so the app can clearly tell users which providers support image input, audio input, video input, tool calling, JSON mode, local inference, and transcription. That would make AuTuber more reliable across cloud and self-hosted models.

We also plan to add more automation profiles. A gaming stream, chatting stream, classroom lecture, podcast, and live event all need different behavior. Profiles would let creators choose how reactive, quiet, funny, or production-focused the assistant should be.

For OBS, we want to expand beyond AFK overlays into safe scene suggestions, source visibility workflows, stream alerts, and production cues, while keeping risky actions behind confirmation controls.

For VTube Studio, we want better emotion detection, stronger hotkey classification, easier cue-label editing, and better handling of toggle-style emotes that need automatic deactivation.

Long term, AuTuber could become a general AI stagehand for live digital performance. VTubers are the perfect starting point because avatar expression is central to the experience, but the same system could support streamers, esports commentators, educators, event hosts, and anyone who performs live while managing complex software.