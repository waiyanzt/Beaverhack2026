import type { ModelProviderConfig, ModelProviderId, OpenRouterOptions, VllmOptions } from "../../../shared/model.types";
import { PROVIDER_VLLM } from "../../../shared/model.types";

const SELECTED_PROVIDER: ModelProviderId = PROVIDER_VLLM;

const vllmOptions: VllmOptions = {
  enableThinking: false,
};

const openrouterOptions: OpenRouterOptions = {
  refererUrl: "https://autuber.app",
  appTitle: "AuTuber",
};

function buildProviders(): ModelProviderConfig[] {
  return [
    {
      id: PROVIDER_VLLM,
      label: "vLLM (Nemotron)",
      baseUrl: "http://100.93.134.64:8000",
      model: "/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120",
      apiKey: null,
      enabled: true,
      supportsToolCalling: true,
      supportsJsonMode: true,
      supportsForcedToolChoice: true,
      supportsStrictJsonSchema: true,
      maxTokens: 512,
      temperature: 0.2,
      topP: 0.9,
      vllm: vllmOptions,
    },
    {
      id: "openrouter" as const,
      label: "OpenRouter (Gemini 3.1 Flash Lite)",
      baseUrl: "https://openrouter.ai/api",
      model: "google/gemini-2.5-flash-lite",
      apiKey: process.env.OPENROUTER_API_KEY ?? null,
      enabled: true,
      supportsToolCalling: true,
      supportsJsonMode: true,
      supportsForcedToolChoice: true,
      supportsStrictJsonSchema: true,
      maxTokens: 512,
      temperature: 0.2,
      topP: 0.9,
      openrouter: openrouterOptions,
    },
  ];
}

export function getModelProviders(): ModelProviderConfig[] {
  return buildProviders();
}

export function getSelectedModelProviderId(): ModelProviderId {
  return SELECTED_PROVIDER;
}

export function setSelectedModelProviderId(_providerId: ModelProviderId): void {
  // Provider selection is now a code constant; this is a no-op for IPC compatibility.
}
