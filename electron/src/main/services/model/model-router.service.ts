import type {
  ModelProviderConfig,
  ModelProviderId,
  ModelProviderTestResult,
  OpenAICompatibleMessage,
} from "../../../shared/model.types";
import { OpenAICompatibleProvider } from "./openai-compatible.provider";

export interface ModelProviderStore {
  getProviders(): ModelProviderConfig[];
  getSelectedProviderId(): ModelProviderId;
}

export class ModelRouterService {
  public constructor(
    private readonly store: ModelProviderStore,
    private readonly openAICompatibleProvider: OpenAICompatibleProvider,
  ) {}

  public async testConnection(): Promise<ModelProviderTestResult> {
    const provider = this.store.getProviders().find((candidate) => candidate.id === this.store.getSelectedProviderId());

    if (!provider) {
      return {
        providerId: this.store.getSelectedProviderId(),
        ok: false,
        status: null,
        message: "No selected provider is configured.",
      };
    }

    if (!provider.enabled) {
      return {
        providerId: provider.id,
        ok: false,
        status: null,
        message: "Selected provider is disabled.",
      };
    }

    if (provider.id === "openrouter" || provider.id === "vllm") {
      const result = await this.openAICompatibleProvider.testConnection(provider);

      return {
        providerId: provider.id,
        ok: result.ok,
        status: result.status,
        message: result.ok ? "Connection successful." : result.content || "Connection failed.",
      };
    }

    return {
      providerId: provider.id,
      ok: false,
      status: null,
      message: "Mock provider does not perform external connection tests.",
    };
  }

  public async createActionPlan(messages: OpenAICompatibleMessage[]): Promise<{
    providerId: ModelProviderId;
    ok: boolean;
    status: number | null;
    content: string;
    actionPlan?: unknown;
  }> {
    const provider = this.store.getProviders().find((candidate) => candidate.id === this.store.getSelectedProviderId());

    if (!provider) {
      return {
        providerId: this.store.getSelectedProviderId(),
        ok: false,
        status: null,
        content: "No selected provider is configured.",
      };
    }

    if (!provider.enabled) {
      return {
        providerId: provider.id,
        ok: false,
        status: null,
        content: "Selected provider is disabled.",
      };
    }

    if (provider.id === "mock") {
      return {
        providerId: provider.id,
        ok: true,
        status: 200,
        content: "Mock provider received the rolling capture window.",
      };
    }

    const result = await this.openAICompatibleProvider.createActionPlan(provider, messages);

    return {
      providerId: provider.id,
      ok: result.ok,
      status: result.status,
      content: result.content,
      actionPlan: result.actionPlan,
    };
  }
}
