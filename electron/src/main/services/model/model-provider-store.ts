import type { ModelProviderConfig, ModelProviderId } from "../../../shared/model.types";

const providers: ModelProviderConfig[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    model: "openai/gpt-4o-mini",
    apiKey: process.env.OPENROUTER_API_KEY ?? null,
    enabled: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
    supportsForcedToolChoice: true,
    supportsStrictJsonSchema: true,
  },
  {
    id: "vllm",
    label: "vLLM (Nemotron)",
    baseUrl: "http://127.0.0.1:8000",
    model: "/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120",
    apiKey: null,
    enabled: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
    supportsForcedToolChoice: true,
    supportsStrictJsonSchema: true,
    maxTokens: 25600,
  },
  {
    id: "mock",
    label: "Mock",
    baseUrl: "http://127.0.0.1",
    model: "mock",
    apiKey: null,
    enabled: true,
    supportsToolCalling: false,
    supportsJsonMode: false,
  },
];

let selectedProviderId: ModelProviderId = "vllm";

export function getModelProviders(): ModelProviderConfig[] {
  return providers.map((provider) => ({ ...provider }));
}

export function getSelectedModelProviderId(): ModelProviderId {
  return selectedProviderId;
}

export function setSelectedModelProviderId(providerId: ModelProviderId): void {
  selectedProviderId = providerId;
}
