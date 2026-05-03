export type ModelProviderId = "openrouter" | "vllm" | "mock";

export interface ModelProviderConfig {
  id: ModelProviderId;
  label: string;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  enabled: boolean;
  supportsToolCalling: boolean;
  supportsJsonMode: boolean;
  supportsForcedToolChoice?: boolean;
  supportsStrictJsonSchema?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  vllm?: VllmOptions;
}

export interface VllmOptions {
  thinkingTokenBudget?: number;
  thinkingGracePeriod?: number;
  enableThinking?: boolean;
  useAudioInVideo?: boolean;
}

export interface ModelProviderTestResult {
  providerId: ModelProviderId;
  ok: boolean;
  status: number | null;
  message: string;
}

export interface OpenAICompatibleMessagePartText {
  type: "text";
  text: string;
}

export interface OpenAICompatibleImageUrl {
  url: string;
  detail: "low" | "high" | "auto";
}

export interface OpenAICompatibleMessagePartImageUrl {
  type: "image_url";
  image_url: OpenAICompatibleImageUrl;
}

export interface OpenAICompatibleVideoUrl {
  url: string;
}

export interface OpenAICompatibleMessagePartVideoUrl {
  type: "video_url";
  video_url: OpenAICompatibleVideoUrl;
}

export type OpenAICompatibleMessagePart =
  | OpenAICompatibleMessagePartText
  | OpenAICompatibleMessagePartImageUrl
  | OpenAICompatibleMessagePartVideoUrl;

export interface OpenAICompatibleMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAICompatibleMessagePart[];
}

export interface OpenAICompatibleToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

export interface OpenAICompatibleTool {
  type: "function";
  function: OpenAICompatibleToolFunction;
}

export type OpenAICompatibleToolChoice = "none" | "auto" | "required" | { type: "function"; function: { name: string } };

export interface OpenAICompatibleJsonSchema {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
}

export interface OpenAICompatibleResponseFormat {
  type: "json_schema" | "json_object";
  json_schema?: OpenAICompatibleJsonSchema;
}

export interface OpenAICompatibleChatRequest {
  model: string;
  messages: OpenAICompatibleMessage[];
  tools?: OpenAICompatibleTool[];
  tool_choice?: OpenAICompatibleToolChoice;
  response_format?: OpenAICompatibleResponseFormat;
  temperature: number;
  max_tokens: number;
  stream: false;
  top_p?: number;
  extra_body?: Record<string, unknown>;
}

export interface OpenAICompatibleToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAICompatibleChatChoice {
  message?: {
    content?: string | null;
    tool_calls?: OpenAICompatibleToolCall[];
    role?: string;
  };
  finish_reason?: string;
}

export interface OpenAICompatibleChatResponse {
  choices?: OpenAICompatibleChatChoice[];
}
