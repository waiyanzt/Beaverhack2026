import type { ModelProviderConfig, ModelProviderId } from "../../../shared/model.types";

const providers: ModelProviderConfig[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    model: "openai/gpt-4o-mini",
    apiKey: process.env.OPENROUTER_API_KEY ?? null,
    enabled: true,
  },
  {
    id: "vllm",
    label: "vLLM OpenAI-Compatible",
    baseUrl: "http://127.0.0.1:8000",
    model: "local-model",
    apiKey: null,
    enabled: false,
  },
  {
    id: "mock",
    label: "Mock",
    baseUrl: "http://127.0.0.1",
    model: "mock",
    apiKey: null,
    enabled: true,
  },
];

let selectedProviderId: ModelProviderId = "openrouter";

export function getModelProviders(): ModelProviderConfig[] {
  return providers.map((provider) => ({ ...provider }));
}

export function getSelectedModelProviderId(): ModelProviderId {
  return selectedProviderId;
}

export function setSelectedModelProviderId(providerId: ModelProviderId): void {
  selectedProviderId = providerId;
}
