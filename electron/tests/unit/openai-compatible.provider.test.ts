import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "../../src/main/services/model/openai-compatible.provider";
import type { ModelProviderConfig } from "../../src/shared/model.types";

const providerConfig: ModelProviderConfig = {
  id: "vllm",
  label: "vLLM",
  baseUrl: "http://localhost:8000",
  model: "demo-model",
  apiKey: null,
  enabled: true,
  supportsToolCalling: true,
  supportsJsonMode: true,
  supportsForcedToolChoice: true,
  supportsStrictJsonSchema: true,
  maxTokens: 768,
  temperature: 0.2,
};

describe("OpenAICompatibleProvider", () => {
  it("returns a fallback noop action plan when tool-call output is truncated", async () => {
    const provider = new OpenAICompatibleProvider({
      postJson: vi.fn().mockResolvedValue({
        status: 200,
        body: JSON.stringify({
          choices: [
            {
              finish_reason: "length",
              message: {
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "create_action_plan",
                      arguments: "{\"actions\":[",
                    },
                  },
                ],
              },
            },
          ],
        }),
      }),
    });

    const result = await provider.createActionPlan(providerConfig, [{ role: "system", content: "test" }]);

    expect(result.ok).toBe(true);
    expect(result.finishReason).toBe("fallback");
    expect(result.actionPlan).toMatchObject({
      actions: [
        {
          type: "noop",
          reason: "Model output was truncated before tool arguments completed.",
        },
      ],
    });
  });

  it("strips VTS-only fields from noop actions before validation", async () => {
    const provider = new OpenAICompatibleProvider({
      postJson: vi.fn().mockResolvedValue({
        status: 200,
        body: JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "create_action_plan",
                      arguments: JSON.stringify({
                        actions: [
                          {
                            type: "noop",
                            actionId: "noop_001",
                            reason: "No triggerable cue is visible.",
                            cueLabels: [],
                            confidence: 0.92,
                            visualEvidence: "Neutral expression.",
                          },
                        ],
                        safety: {
                          riskLevel: "low",
                          requiresConfirmation: false,
                        },
                        nextTick: {
                          suggestedDelayMs: 0,
                          priority: "normal",
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      }),
    });

    const result = await provider.createActionPlan(providerConfig, [{ role: "system", content: "test" }]);

    expect(result.ok).toBe(true);
    expect(result.actionPlan).toMatchObject({
      actions: [
        {
          type: "noop",
          actionId: "noop_001",
          reason: "No triggerable cue is visible.",
        },
      ],
      nextTick: {
        suggestedDelayMs: 500,
      },
    });
  });

  it("constrains VTS cue-label tool schema to labels from the live prompt", async () => {
    const postJson = vi.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "create_action_plan",
                    arguments: JSON.stringify({
                      actions: [
                        {
                          type: "noop",
                          actionId: "noop_001",
                          reason: "No triggerable cue is visible.",
                        },
                      ],
                      safety: {
                        riskLevel: "low",
                        requiresConfirmation: false,
                      },
                      nextTick: {
                        suggestedDelayMs: 1000,
                        priority: "normal",
                      },
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
    });
    const provider = new OpenAICompatibleProvider({ postJson });

    await provider.createActionPlan(providerConfig, [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              capture: {
                allowedCueLabels: ["laughing", "surprised"],
              },
            }),
          },
        ],
      },
    ]);

    const request = postJson.mock.calls[0]?.[1] as {
      tools?: Array<{
        function: {
          parameters: {
            properties: {
              actions: {
                items: {
                  properties: {
                    cueLabels: {
                      items: {
                        enum: string[];
                      };
                    };
                  };
                };
              };
            };
          };
        };
      }>;
    };

    expect(request.tools?.[0]?.function.parameters.properties.actions.items.properties.cueLabels.items.enum).toEqual([
      "laughing",
      "surprised",
    ]);
  });
});
