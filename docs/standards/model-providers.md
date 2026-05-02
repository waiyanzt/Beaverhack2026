# Model Provider Standard

Model provider integration must route through the main process `ModelRouter` described in [SPEC.md](../../SPEC.md).

Renderer code must not call model providers directly.

For OpenAI-compatible providers, prefer a single transport layer that can swap `baseUrl` and `model` without changing the IPC contract. OpenRouter can be the default provider, while vLLM should be reachable by changing only the configured endpoint.

The model HTTP call should live in the Electron main process service layer, behind `ModelRouter`, with the provider implementation responsible only for building the OpenAI-compatible request and posting it to `/v1/chat/completions`.
