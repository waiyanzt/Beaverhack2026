/**
 * OpenRouter provider.
 *
 * OpenRouter is handled through the generic `OpenAICompatibleProvider` because
 * it exposes an OpenAI-compatible chat completions endpoint. The only
 * divergences are provider-specific request headers (e.g. `HTTP-Referer`,
 * `X-Title`) which are injected in `OpenAICompatibleProvider` when
 * `config.id === PROVIDER_OPENROUTER`.
 *
 * For differences from the vLLM path, see the hotswap points in
 * `openai-compatible.provider.ts` (the `if (config.id === PROVIDER_OPENROUTER)`
 * blocks that add optional identification headers).
 *
 * No separate provider class is needed.
 */

export {};
