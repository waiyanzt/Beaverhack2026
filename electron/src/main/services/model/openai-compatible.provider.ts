import { z } from "zod";
import type {
  ModelProviderConfig,
  OpenAICompatibleChatRequest,
  OpenAICompatibleMessage,
  OpenAICompatibleTool,
} from "../../../shared/model.types";
import { actionPlanSchema } from "../../../shared/schemas/action-plan.schema";

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
}

function summarizeMessagesForLog(messages: OpenAICompatibleMessage[]): string {
  const parts: string[] = [];
  let imageCount = 0;
  let videoSeconds = 0;
  let audioSeconds = 0;

  for (const message of messages) {
    let textPreview = "";

    if (typeof message.content === "string") {
      textPreview = message.content;
    } else if (Array.isArray(message.content)) {
      const textParts: string[] = [];
      for (const part of message.content) {
        if (part.type === "text") {
          textParts.push(part.text);
        } else if (part.type === "image_url") {
          imageCount++;
        }
        // Future: video and audio parts will increment videoSeconds / audioSeconds
      }
      textPreview = textParts.join(" ");
    }

    parts.push(`[${message.role}: ${textPreview}]`);
  }

  const mediaParts: string[] = [];
  if (imageCount > 0) mediaParts.push(imageCount === 1 ? "one image file" : `${imageCount} image files`);
  if (videoSeconds > 0) mediaParts.push(`${videoSeconds} sec video`);
  else mediaParts.push("0 sec video");
  if (audioSeconds > 0) mediaParts.push(`audio ${audioSeconds} secs`);
  else mediaParts.push("audio 0 secs");

  return `${parts.join(" ")} [${mediaParts.join(" + ")}]`;
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
    hotkeyId: {
      type: "string",
      description: "For vts.trigger_hotkey: the semantic name/ID of the hotkey to trigger (e.g., 'wave', 'laugh', 'surprise').",
    },
    intensity: {
      type: "number",
      description: "For vts.trigger_hotkey: intensity from 0 to 1.",
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
          required: ["visibleToUser"],
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
      required: ["schemaVersion", "tickId", "createdAt", "actions", "safety", "nextTick"],
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
    const request: OpenAICompatibleChatRequest = {
      model: config.model,
      messages,
      tools: [createActionPlanTool],
      tool_choice: { type: "function", function: { name: "create_action_plan" } },
      temperature: 0.4,
      max_tokens: 2048,
      stream: false,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    console.log(`RAW PROMPT: "${summarizeMessagesForLog(messages)}"`);

    const response = await this.client.postJson(`${config.baseUrl}${this.endpointPath}`, request, headers);

    console.log(`RAW OUTPUT: "${response.body.replace(/"/g, '"')}"`);

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
        content: "Invalid model provider response structure.",
      };
    }

    const choice = parsed.data.choices?.[0];
    const message = choice?.message;
    const toolCalls = message?.tool_calls;

    // If we got tool calls, extract the action plan
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];

      if (toolCall.function.name !== "create_action_plan") {
        return {
          ok: false,
          status: response.status,
          content: `Unexpected tool call: ${toolCall.function.name}`,
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
        };
      }

      const validated = actionPlanSchema.safeParse(actionPlanJson);

      if (!validated.success) {
        return {
          ok: false,
          status: response.status,
          content: `Action plan validation failed: ${validated.error.message}`,
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
      };
    }

    // Fallback: try to parse content as JSON action plan
    const content = message?.content;

    if (content) {
      try {
        const jsonContent = JSON.parse(content) as unknown;
        const validated = actionPlanSchema.safeParse(jsonContent);

        if (validated.success) {
          return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            content,
            actionPlan: validated.data,
          };
        }
      } catch {
        // Not valid JSON, return as plain text
      }
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      content: content ?? "No response content.",
    };
  }

  public async chat(config: ModelProviderConfig, messages: OpenAICompatibleMessage[]): Promise<OpenAICompatibleProviderResult> {
    const request: OpenAICompatibleChatRequest = {
      model: config.model,
      messages,
      temperature: 0.4,
      max_tokens: 1024,
      stream: false,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    console.log(`RAW PROMPT: "${summarizeMessagesForLog(messages)}"`);

    const response = await this.client.postJson(`${config.baseUrl}${this.endpointPath}`, request, headers);

    console.log(`RAW OUTPUT: "${response.body.replace(/"/g, '"')}"`);

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
      };
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      content: parsed.data.choices?.[0]?.message?.content ?? "",
    };
  }

  public async testConnection(config: ModelProviderConfig): Promise<OpenAICompatibleProviderResult> {
    return this.chat(config, [
      { role: "system", content: "connection check" },
      { role: "user", content: "ping" },
    ]);
  }
}
