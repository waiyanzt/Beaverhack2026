# Model Provider Standard

Model provider integration must route through the main process `ModelRouter` described in [SPEC.md](../../SPEC.md).

Renderer code must not call model providers directly.

For OpenAI-compatible providers, prefer a single transport layer that can swap `baseUrl` and `model` without changing the IPC contract. OpenRouter can be the default provider, while vLLM should be reachable by changing only the configured endpoint.

The model HTTP call should live in the Electron main process service layer, behind `ModelRouter`, with the provider implementation responsible only for building the OpenAI-compatible request and posting it to `/v1/chat/completions`.

## Live Provider Roles

The live dashboard now uses two explicit provider roles:

- Primary provider: the selected `vllm` provider entry, currently pointed at the LM Studio OpenAI-compatible endpoint on `http://192.168.240.1:1234/v1` with `nvidia/nemotron-3-nano-omni`. This role is frame-only and should only receive `image_url` plus text because the running LM Studio route does not accept raw `video_url` or audio chat parts.
- Secondary provider: the explicit `secondary` provider entry, currently pointed at the remote Nemotron vLLM endpoint on `http://100.93.134.64:8000`. This role is the multimodal clip path and can receive a 2-second `video_url` clip plus separate audio context.

Provider routing must stay in the main-process `ModelRouter`. The dashboard monitor may select providers explicitly per pass instead of relying only on the globally selected provider.
