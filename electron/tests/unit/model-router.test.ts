import { describe, expect, it, vi } from "vitest";
import { ModelRouterService } from "../../src/main/services/model/model-router.service";
import type { ModelProviderConfig } from "../../src/shared/model.types";

const provider: ModelProviderConfig = {
  id: "openrouter",
  label: "OpenRouter",
  baseUrl: "https://openrouter.ai/api",
  model: "openai/gpt-4o-mini",
  apiKey: "secret-key",
  enabled: true,
  supportsToolCalling: true,
  supportsJsonMode: true,
};

describe("ModelRouterService", () => {
  it("calls the openai-compatible provider for openrouter", async () => {
    const providerClient = {
      testConnection: vi.fn().mockResolvedValue({ ok: true, status: 200, content: "pong" }),
    };

    const router = new ModelRouterService(
      {
        getProviders: () => [provider],
        getSelectedProviderId: () => "openrouter",
      },
      providerClient as never,
    );

    const result = await router.testConnection();

    expect(result.ok).toBe(true);
    expect(providerClient.testConnection).toHaveBeenCalledTimes(1);
  });
});
