import type {
  ModelProviderConfig,
  ModelProviderId,
  ModelProviderTestResult,
  OpenAICompatibleMessage,
} from "../../../shared/model.types";
import { createId } from "../../utils/ids";
import { OpenAICompatibleProvider, type OpenAICompatibleProviderResult } from "./openai-compatible.provider";

export interface ModelProviderStore {
  getProviders(): ModelProviderConfig[];
  getSelectedProviderId(): ModelProviderId;
}

export interface ModelActionPlanResponse {
  providerId: ModelProviderId;
  ok: boolean;
  status: number | null;
  content: string;
  actionPlan?: unknown;
  finishReason?: string | null;
  usage?: OpenAICompatibleProviderResult["usage"];
}

export interface ModelChatResponse {
  providerId: ModelProviderId;
  ok: boolean;
  status: number | null;
  content: string;
  finishReason?: string | null;
  usage?: OpenAICompatibleProviderResult["usage"];
}

export class ModelRouterService {
  public constructor(
    private readonly store: ModelProviderStore,
    private readonly openAICompatibleProvider: OpenAICompatibleProvider,
  ) {}

  public async testConnection(providerId?: ModelProviderId): Promise<ModelProviderTestResult> {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return {
        providerId: providerId ?? this.store.getSelectedProviderId(),
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

    if (provider.id === "openrouter" || provider.id === "vllm" || provider.id === "secondary") {
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

  public async createActionPlan(messages: OpenAICompatibleMessage[], providerId?: ModelProviderId): Promise<unknown> {
    const result = await this.requestActionPlan(messages, providerId);

    if (!result.ok || !result.actionPlan) {
      throw new Error(result.content || "Model provider did not return an action plan.");
    }

    return result.actionPlan;
  }

  public async requestActionPlan(
    messages: OpenAICompatibleMessage[],
    providerId?: ModelProviderId,
  ): Promise<ModelActionPlanResponse> {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return {
        providerId: providerId ?? this.store.getSelectedProviderId(),
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
        actionPlan: {
          schemaVersion: "2026-05-02",
          tickId: createId("tick"),
          createdAt: new Date().toISOString(),
          actions: [
            {
              type: "noop",
              actionId: createId("act"),
              reason: "Mock provider returned a safe noop plan.",
            },
          ],
          safety: {
            riskLevel: "low",
            requiresConfirmation: false,
          },
          nextTick: {
            suggestedDelayMs: 5000,
            priority: "normal",
          },
          debug: {
            provider: provider.id,
            model: provider.model,
          },
        },
      };
    }

    const result = await this.openAICompatibleProvider.createActionPlan(provider, messages);

    return {
      providerId: provider.id,
      ok: result.ok,
      status: result.status,
      content: result.content,
      actionPlan: result.actionPlan,
      finishReason: result.finishReason,
      usage: result.usage,
    };
  }

  public async requestChat(messages: OpenAICompatibleMessage[], providerId?: ModelProviderId): Promise<ModelChatResponse> {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return {
        providerId: providerId ?? this.store.getSelectedProviderId(),
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
        ok: false,
        status: 200,
        content: "Mock provider does not support VTS catalog generation.",
      };
    }

    const result = await this.openAICompatibleProvider.chat(provider, messages);

    return {
      providerId: provider.id,
      ok: result.ok,
      status: result.status,
      content: result.content,
      finishReason: result.finishReason,
      usage: result.usage,
    };
  }

  private getProvider(providerId?: ModelProviderId): ModelProviderConfig | undefined {
    const selectedProviderId = providerId ?? this.store.getSelectedProviderId();
    return this.store.getProviders().find((candidate) => candidate.id === selectedProviderId);
  }
}
