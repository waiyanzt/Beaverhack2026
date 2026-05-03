import type { ModelProviderConfig, ModelProviderId, VllmOptions } from "../../../shared/model.types";
import { settingsService } from "../settings/settings.service";

const vllmOptions: VllmOptions = {
  enableThinking: false,
  useAudioInVideo: true,
};

const providers: ModelProviderConfig[] = [
  {
    id: "vllm",
    label: "vLLM (Nemotron)",
    baseUrl: "http://100.93.134.64:8000",
    model: "/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120",
    apiKey: null,
    enabled: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
    supportsForcedToolChoice: true,
    supportsStrictJsonSchema: true,
    maxTokens: 768,
    temperature: 0.2,
    topP: 0.9,
    vllm: vllmOptions,
  },
];

export function getModelProviders(): ModelProviderConfig[] {
  return providers.map((provider) => ({ ...provider }));
}

export function getSelectedModelProviderId(): ModelProviderId {
  return settingsService.getSettings().model.selectedProviderId;
}

export function setSelectedModelProviderId(providerId: ModelProviderId): void {
  settingsService.updateModelConfig({
    selectedProviderId: providerId,
  });
}
