import { z } from "zod";
import type {
  ModelProviderConfig,
  OpenAICompatibleChatRequest,
  OpenAICompatibleMessage,
  OpenAICompatibleTool,
  OpenAICompatibleToolChoice,
} from "../../../shared/model.types";
import { actionPlanSchema } from "../../../shared/schemas/action-plan.schema";

function extractProviderError(rawBody: unknown): string | null {
  if (typeof rawBody === "object" && rawBody !== null && "error" in rawBody) {
    const err = (rawBody as Record<string, unknown>).error;
    if (typeof err === "object" && err !== null && "message" in err) {
      return String((err as Record<string, unknown>).message);
    }
    return String(err);
  }
  return null;
}

const toolCallResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z
        .object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.literal("function"),
                function: z.object({
                  name: z.string(),
                  arguments: z.string(),
                }),
              }),
            )
            .optional(),
          role: z.string().optional(),
        })
        .optional(),
      finish_reason: z.string().optional(),
    }),
  ).optional(),
});

export interface OpenAICompatibleProviderClient {
  postJson(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; body: string }>;
}

export interface OpenAICompatibleProviderResult {
  ok: boolean;
  status: number;
  content: string;
  actionPlan?: unknown;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  usage?: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
}

function extractUsage(rawBody: unknown): OpenAICompatibleProviderResult["usage"] {
  if (typeof rawBody !== "object" || rawBody === null || !("usage" in rawBody)) {
    return undefined;
  }

  const usage = (rawBody as Record<string, unknown>).usage;
  if (typeof usage !== "object" || usage === null) {
    return undefined;
  }

  const record = usage as Record<string, unknown>;
  return {
    promptTokens: typeof record.prompt_tokens === "number" ? record.prompt_tokens : null,
    completionTokens: typeof record.completion_tokens === "number" ? record.completion_tokens : null,
    totalTokens: typeof record.total_tokens === "number" ? record.total_tokens : null,
  };
}

function stripMarkdownCodeBlocks(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

function redactModelLogValue(value: unknown): unknown {
  if (typeof value === "string") {
    const dataUrlMatch = value.match(/^(data:(?:image|video|audio)\/[^;,]+(?:;[^,]*)?,)/);

    if (dataUrlMatch) {
      return `${dataUrlMatch[1]}<redacted ${value.length} chars>`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactModelLogValue(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, redactModelLogValue(entry)]),
    );
  }

  return value;
}

function formatModelLogJson(value: unknown): string {
  return JSON.stringify(redactModelLogValue(value), null, 2);
}

function parseModelResponseForLog(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function logModelRequest(label: string, url: string, request: OpenAICompatibleChatRequest): void {
  console.log(
    `${label} REQUEST ${formatModelLogJson({
      url,
      request,
    })}`,
  );
}

function logModelResponse(label: string, status: number, body: string): void {
  console.log(
    `${label} RESPONSE ${formatModelLogJson({
      status,
      body: parseModelResponseForLog(body),
    })}`,
  );
}

function buildActionProperties(): Record<string, unknown> {
  return {
    type: {
      type: "string",
      enum: [
        "vts.trigger_hotkey",
        "vts.set_parameter",
        "obs.set_scene",
        "obs.set_source_visibility",
        "overlay.message",
        "log.event",
        "noop",
      ],
      description: "Action type. Use 'noop' when no action is needed.",
    },
    actionId: {
      type: "string",
      description: "Unique identifier for this action instance.",
    },
    reason: {
      type: "string",
      description: "Short explanation of why this action was chosen.",
    },
    // VTS hotkey fields
    catalogId: {
      type: "string",
      description: "For vts.trigger_hotkey: the catalogId from the user-defined services.vts.automationCatalog.candidates entry you want.",
    },
    catalogVersion: {
      type: "string",
      description: "For vts.trigger_hotkey: the current services.vts.automationCatalog.version value.",
    },
    hotkeyId: {
      type: "string",
      description: "Deprecated fallback for vts.trigger_hotkey. Prefer catalogId and catalogVersion instead of choosing raw VTS hotkey IDs directly.",
    },
    intensity: {
      type: "number",
      description: "For vts.trigger_hotkey: intensity from 0 to 1.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "For vts.trigger_hotkey: confidence from 0 to 1 that the current media directly and unambiguously supports this action.",
    },
    visualEvidence: {
      type: "string",
      description: "For vts.trigger_hotkey: concrete visual evidence from the current frame/clip, such as a visible wave, smile, laugh, surprise expression, or covered camera.",
    },
    // VTS parameter fields
    parameterId: {
      type: "string",
      description: "For vts.set_parameter: the parameter to adjust.",
    },
    value: {
      type: "number",
      description: "For vts.set_parameter: the target value.",
    },
    weight: {
      type: "number",
      description: "For vts.set_parameter: blend weight from 0 to 1.",
    },
    durationMs: {
      type: "number",
      description: "For vts.set_parameter: duration in milliseconds.",
    },
    // OBS fields
    sceneName: {
      type: "string",
      description: "For obs.set_scene or obs.set_source_visibility: the scene name.",
    },
    sourceName: {
      type: "string",
      description: "For obs.set_source_visibility: the source name.",
    },
    visible: {
      type: "boolean",
      description: "For obs.set_source_visibility: true to show, false to hide.",
    },
    // Overlay fields
    message: {
      type: "string",
      description: "For overlay.message: the text to display. Keep it short.",
    },
    displayDurationMs: {
      type: "number",
      description: "For overlay.message: how long to show the message in milliseconds.",
    },
    // Log fields
    level: {
      type: "string",
      enum: ["debug", "info", "warn", "error"],
      description: "For log.event: the log level.",
    },
    metadata: {
      type: "object",
      description: "For log.event: optional extra data.",
    },
  };
}

function buildActionPlanJsonSchema(): Record<string, unknown> {
  const actionProperties = buildActionProperties();

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      schemaVersion: {
        type: "string",
        enum: ["2026-05-02"],
        description: "Schema version identifier.",
      },
      tickId: {
        type: "string",
        description: "Unique identifier for this tick.",
      },
      createdAt: {
        type: "string",
        description: "ISO 8601 timestamp of when the plan was created.",
      },
      response: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: {
            type: "string",
            description: "Optional response text to show the user.",
          },
          audioTranscript: {
            type: "string",
            description: "Full transcript of audible speech in the clip. Use '[no speech]' when no speech is audible and '[inaudible]' when speech is present but unclear.",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence score from 0 to 1.",
          },
          visibleToUser: {
            type: "boolean",
            description: "Whether this response should be visible to the user.",
          },
        },
        required: ["visibleToUser", "audioTranscript"],
      },
      actions: {
        type: "array",
        description: "List of actions to perform. Use noop if no action is needed. Prefer fewer actions.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: actionProperties,
          required: ["type", "actionId", "reason"],
        },
      },
      safety: {
        type: "object",
        additionalProperties: false,
        properties: {
          riskLevel: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Risk level of this action plan.",
          },
          requiresConfirmation: {
            type: "boolean",
            description: "Whether user confirmation is required before executing.",
          },
          reason: {
            type: "string",
            description: "Explanation of risk assessment.",
          },
        },
        required: ["riskLevel", "requiresConfirmation"],
      },
      nextTick: {
        type: "object",
        additionalProperties: false,
        properties: {
          suggestedDelayMs: {
            type: "number",
            description: "Suggested delay in milliseconds before next tick.",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high"],
            description: "Priority for the next tick.",
          },
        },
        required: ["suggestedDelayMs", "priority"],
      },
      debug: {
        type: "object",
        additionalProperties: false,
        properties: {
          provider: { type: "string" },
          model: { type: "string" },
          promptTokens: { type: "number" },
          completionTokens: { type: "number" },
        },
      },
    },
    required: ["schemaVersion", "tickId", "createdAt", "response", "actions", "safety", "nextTick"],
  };
}

function injectJsonModeInstructions(messages: OpenAICompatibleMessage[], includeSchema: boolean = false): OpenAICompatibleMessage[] {
  let instruction =
    "You MUST respond with a single JSON object matching the ActionPlan schema. Do not wrap it in markdown code blocks. Do not include any text outside the JSON object.";

  if (includeSchema) {
    instruction += `\n\nActionPlan schema:\n${JSON.stringify(buildActionPlanJsonSchema(), null, 2)}`;
  }

  const firstSystemIndex = messages.findIndex((m) => m.role === "system");

  if (firstSystemIndex >= 0) {
    const msg = messages[firstSystemIndex];
    const newContent =
      typeof msg.content === "string"
        ? `${msg.content}\n\n${instruction}`
        : [...msg.content, { type: "text" as const, text: instruction }];

    return messages.map((m, i) => (i === firstSystemIndex ? { ...m, content: newContent } : m));
  }

  return [{ role: "system", content: instruction }, ...messages];
}

export const createActionPlanTool: OpenAICompatibleTool = {
  type: "function",
  function: {
    name: "create_action_plan",
    description: "Create a structured local action plan for the desktop app to validate and execute.",
    parameters: {
      type: "object",
      properties: {
        schemaVersion: {
          type: "string",
          enum: ["2026-05-02"],
          description: "Schema version identifier.",
        },
        tickId: {
          type: "string",
          description: "Unique identifier for this tick.",
        },
        createdAt: {
          type: "string",
          description: "ISO 8601 timestamp of when the plan was created.",
        },
        response: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Optional response text to show the user.",
            },
            audioTranscript: {
              type: "string",
              description: "Full transcript of audible speech in the clip. Use '[no speech]' when no speech is audible and '[inaudible]' when speech is present but unclear.",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence score from 0 to 1.",
            },
            visibleToUser: {
              type: "boolean",
              description: "Whether this response should be visible to the user.",
            },
          },
          required: ["visibleToUser", "audioTranscript"],
        },
        actions: {
          type: "array",
          description: "List of actions to perform. Use noop if no action is needed. Prefer fewer actions.",
          items: {
            type: "object",
            properties: buildActionProperties(),
            required: ["type", "actionId", "reason"],
          },
        },
        safety: {
          type: "object",
          properties: {
            riskLevel: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Risk level of this action plan.",
            },
            requiresConfirmation: {
              type: "boolean",
              description: "Whether user confirmation is required before executing.",
            },
            reason: {
              type: "string",
              description: "Explanation of risk assessment.",
            },
          },
          required: ["riskLevel", "requiresConfirmation"],
        },
        nextTick: {
          type: "object",
          properties: {
            suggestedDelayMs: {
              type: "number",
              description: "Suggested delay in milliseconds before next tick.",
            },
            priority: {
              type: "string",
              enum: ["low", "normal", "high"],
              description: "Priority for the next tick.",
            },
          },
          required: ["suggestedDelayMs", "priority"],
        },
        debug: {
          type: "object",
          properties: {
            provider: { type: "string" },
            model: { type: "string" },
            promptTokens: { type: "number" },
            completionTokens: { type: "number" },
          },
        },
      },
      required: ["schemaVersion", "tickId", "createdAt", "response", "actions", "safety", "nextTick"],
    },
  },
};

export class OpenAICompatibleProvider {
  public constructor(
    private readonly client: OpenAICompatibleProviderClient,
    private readonly endpointPath: string = "/v1/chat/completions",
  ) {}

  public async createActionPlan(
    config: ModelProviderConfig,
    messages: OpenAICompatibleMessage[],
  ): Promise<OpenAICompatibleProviderResult> {
    const useTools = config.supportsToolCalling;
    const useJsonMode = !useTools && config.supportsJsonMode;

    let requestMessages = messages;

    if (useJsonMode) {
      const includeSchema = config.supportsStrictJsonSchema === false;
      requestMessages = injectJsonModeInstructions(messages, includeSchema);
    }

    let request: OpenAICompatibleChatRequest = {
      model: config.model,
      messages: requestMessages,
      temperature: config.temperature ?? 0.4,
      max_tokens: config.maxTokens ?? 4096,
      stream: false,
    };

    if (config.topP !== undefined) {
      request.top_p = config.topP;
    }

    if (config.vllm) {
      const extra: Record<string, unknown> = {};
      const vllm = config.vllm;

      if (vllm.enableThinking === false) {
        extra.chat_template_kwargs = { enable_thinking: false };
      } else if (vllm.thinkingTokenBudget !== undefined || vllm.enableThinking !== undefined) {
        const thinkingBudget = vllm.thinkingTokenBudget ?? 16384;
        const gracePeriod = vllm.thinkingGracePeriod ?? 1024;
        extra.thinking_token_budget = thinkingBudget + gracePeriod;
        extra.chat_template_kwargs = {
          enable_thinking: vllm.enableThinking ?? true,
          ...(vllm.thinkingTokenBudget !== undefined ? { reasoning_budget: thinkingBudget } : {}),
        };
      }

      if (vllm.useAudioInVideo !== undefined) {
        extra.mm_processor_kwargs = { use_audio_in_video: vllm.useAudioInVideo };
      }

      if (Object.keys(extra).length > 0) {
        request = { ...request, ...extra };
      }
    }

    if (useTools) {
      request = {
        ...request,
        tools: [createActionPlanTool],
      };

      if (config.supportsForcedToolChoice) {
        request.tool_choice = { type: "function", function: { name: "create_action_plan" } };
      }
    } else if (useJsonMode) {
      const useStrictSchema = config.supportsStrictJsonSchema !== false;

      if (useStrictSchema) {
        request = {
          ...request,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "action_plan",
              strict: true,
              schema: buildActionPlanJsonSchema(),
            },
          },
        };
      } else {
        request = {
          ...request,
          response_format: {
            type: "json_object",
          },
        };
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const url = `${config.baseUrl}${this.endpointPath}`;
    logModelRequest("MODEL ACTION PLAN", url, request);

    const response = await this.client.postJson(url, request, headers);

    logModelResponse("MODEL ACTION PLAN", response.status, response.body);

    let rawBody: unknown;

    try {
      rawBody = JSON.parse(response.body) as unknown;
    } catch {
      return {
        ok: false,
        status: response.status,
        content: "Invalid JSON from model provider.",
      };
    }

    const usage = extractUsage(rawBody);
    const parsed = toolCallResponseSchema.safeParse(rawBody);

    if (!parsed.success) {
      const providerError = extractProviderError(rawBody);
      return {
        ok: false,
        status: response.status,
        content: providerError ?? "Invalid model provider response structure.",
        usage,
      };
    }

    const choice = parsed.data.choices?.[0];
    const message = choice?.message;
    const toolCalls = message?.tool_calls;

    // Tool mode path
    if (useTools && toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];

      if (toolCall.function.name !== "create_action_plan") {
        return {
          ok: false,
          status: response.status,
          content: `Unexpected tool call: ${toolCall.function.name}`,
          usage,
        };
      }

      let actionPlanJson: unknown;

      try {
        actionPlanJson = JSON.parse(toolCall.function.arguments) as unknown;
      } catch {
        return {
          ok: false,
          status: response.status,
          content: "Tool call arguments are not valid JSON.",
          usage,
        };
      }

      const validated = actionPlanSchema.safeParse(actionPlanJson);

      if (!validated.success) {
        return {
          ok: false,
          status: response.status,
          content: `Action plan validation failed: ${validated.error.message}`,
          usage,
        };
      }

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        content: JSON.stringify(validated.data, null, 2),
        actionPlan: validated.data,
        toolCalls: toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
        usage,
      };
    }

    // Fallback for tool mode: model may respond with content instead of tool calls
    // This happens with models that support tools but not forced tool_choice,
    // or reasoning models that embed the action plan in message content.
    const content = message?.content;

    if (content) {
      const stripped = stripMarkdownCodeBlocks(content);

      try {
        const jsonContent = JSON.parse(stripped) as unknown;
        const validated = actionPlanSchema.safeParse(jsonContent);

        if (validated.success) {
          return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            content: stripped,
            actionPlan: validated.data,
            usage,
          };
        }
      } catch {
        // Not valid JSON, fall through
      }
    }

    // If tool mode produced no tool calls and no parseable content, report failure
    if (useTools && !content) {
      return {
        ok: false,
        status: response.status,
        content: "Model returned no tool calls and no content. The model may not support the requested tool or forced tool_choice.",
        usage,
      };
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      content: content ?? "No response content.",
      usage,
    };
  }

  public async chat(config: ModelProviderConfig, messages: OpenAICompatibleMessage[]): Promise<OpenAICompatibleProviderResult> {
    let request: OpenAICompatibleChatRequest = {
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.4,
      max_tokens: config.maxTokens ?? 1024,
      stream: false,
    };

    if (config.topP !== undefined) {
      request.top_p = config.topP;
    }

    if (config.vllm) {
      const extra: Record<string, unknown> = {};
      const vllm = config.vllm;

      if (vllm.enableThinking === false) {
        extra.chat_template_kwargs = { enable_thinking: false };
      } else if (vllm.thinkingTokenBudget !== undefined || vllm.enableThinking !== undefined) {
        const thinkingBudget = vllm.thinkingTokenBudget ?? 16384;
        const gracePeriod = vllm.thinkingGracePeriod ?? 1024;
        extra.thinking_token_budget = thinkingBudget + gracePeriod;
        extra.chat_template_kwargs = {
          enable_thinking: vllm.enableThinking ?? true,
          ...(vllm.thinkingTokenBudget !== undefined ? { reasoning_budget: thinkingBudget } : {}),
        };
      }

      if (vllm.useAudioInVideo !== undefined) {
        extra.mm_processor_kwargs = { use_audio_in_video: vllm.useAudioInVideo };
      }

      if (Object.keys(extra).length > 0) {
        request = { ...request, ...extra };
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const url = `${config.baseUrl}${this.endpointPath}`;
    logModelRequest("MODEL CHAT", url, request);

    const response = await this.client.postJson(url, request, headers);

    logModelResponse("MODEL CHAT", response.status, response.body);

    let rawBody: unknown;

    try {
      rawBody = JSON.parse(response.body) as unknown;
    } catch {
      return {
        ok: false,
        status: response.status,
        content: "Invalid JSON from model provider.",
      };
    }

    const parsed = toolCallResponseSchema.safeParse(rawBody);

    if (!parsed.success) {
      return {
        ok: false,
        status: response.status,
        content: "Invalid model provider response",
        usage,
      };
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      content: parsed.data.choices?.[0]?.message?.content ?? "",
      usage,
    };
  }

  public async testConnection(config: ModelProviderConfig): Promise<OpenAICompatibleProviderResult> {
    return this.chat(config, [
      { role: "system", content: "connection check" },
      { role: "user", content: "ping" },
    ]);
  }
}
