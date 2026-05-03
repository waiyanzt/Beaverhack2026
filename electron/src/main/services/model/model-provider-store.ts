import type { ModelProviderConfig, ModelProviderId, VllmOptions } from "../../../shared/model.types";
import { settingsService } from "../settings/settings.service";

const vllmOptions: VllmOptions = {
  enableThinking: false,
  useAudioInVideo: false,
};

const providers: ModelProviderConfig[] = [
  {
    id: "vllm",
    label: "LM Studio (Primary)",
    baseUrl: "http://192.168.240.1:1234/v1",
    model: "nvidia/nemotron-3-nano-omni",
    apiKey: "lm-studio",
    enabled: true,
    timeoutMs: 60_000,
    supportsVision: true,
    supportsAudioInput: false,
    supportsToolCalling: false,
    supportsJsonMode: true,
    supportsForcedToolChoice: false,
    supportsStrictJsonSchema: false,
    maxTokens: 1_024,
    temperature: 0.25,
    topP: 0.9,
  },
  {
    id: "secondary",
    label: "Remote Nemotron Omni (Secondary)",
    baseUrl: "http://100.93.134.64:8000",
    model: "/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120",
    apiKey: null,
    enabled: true,
    timeoutMs: 60_000,
    supportsVision: true,
    supportsAudioInput: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
    supportsForcedToolChoice: true,
    supportsStrictJsonSchema: true,
    maxTokens: 2_048,
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
