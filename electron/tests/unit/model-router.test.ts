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
  supportsForcedToolChoice: true,
  supportsStrictJsonSchema: true,
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

  it("returns a noop action plan for the mock provider", async () => {
    const router = new ModelRouterService(
      {
        getProviders: () => [{ ...provider, id: "mock", model: "mock", baseUrl: "http://mock", supportsToolCalling: false, supportsJsonMode: false }],
        getSelectedProviderId: () => "mock",
      },
      {
        testConnection: vi.fn(),
        createActionPlan: vi.fn(),
      } as never,
    );

    const result = await router.createActionPlan([{ role: "system", content: "test" }]);

    expect(result).toMatchObject({
      schemaVersion: "2026-05-02",
      actions: [
        {
          type: "noop",
        },
      ],
    });
  });

  it("returns provider metadata for monitor requests", async () => {
    const router = new ModelRouterService(
      {
        getProviders: () => [{ ...provider, id: "mock", model: "mock", baseUrl: "http://mock", supportsToolCalling: false, supportsJsonMode: false }],
        getSelectedProviderId: () => "mock",
      },
      {
        testConnection: vi.fn(),
        createActionPlan: vi.fn(),
      } as never,
    );

    const result = await router.requestActionPlan([{ role: "system", content: "test" }]);

    expect(result).toMatchObject({
      providerId: "mock",
      ok: true,
      status: 200,
    });
    expect(result.actionPlan).toMatchObject({
      schemaVersion: "2026-05-02",
      actions: [
        {
          type: "noop",
        },
      ],
    });
  });
});
