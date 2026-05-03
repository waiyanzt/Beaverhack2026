import type { OpenAICompatibleMessage } from "../../../shared/model.types";
import type { ModelControlContext } from "../../../shared/types/observation.types";
import { loadPrompt } from "../../prompts/prompt-loader";
import type { LiveCapturePromptInput } from "./live-capture-input.service";

export interface PromptBuildResult {
  messages: OpenAICompatibleMessage[];
  requestDebug: {
    promptTextBytes: number;
    mediaDataUrlBytes: number;
    sourceWindowKey: string | null;
    sourceClipCount: number;
    modelMediaSha256: string | null;
    modelMediaDataUrl: string | null;
    mediaStartMs: number | null;
    mediaEndMs: number | null;
  };
}

export class PromptBuilderService {
  public buildMessages(
    modelContext: ModelControlContext,
    liveCaptureInput?: LiveCapturePromptInput,
  ): PromptBuildResult {
    const systemPrompt = `${loadPrompt("system").content}\n\n${loadPrompt("action-planner").content}`;
    const basePrompt = {
      instructions: [
        "Here are the current stream controls, observation context, cooldowns, and recent model action plans.",
        "Use recentModelActions as short-term memory for continuity. Take the prior full ActionPlan JSON, action reasons, safety assessment, and execution results into account before choosing the next action.",
        "Avoid repeating an action just because it appears in memory; repeat only when the current observation clearly supports continuing that reaction or behavior.",
      ],
      modelContext,
    };

    if (!liveCaptureInput) {
      const userContent = JSON.stringify(basePrompt, null, 2);

      return {
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        requestDebug: {
          promptTextBytes: Buffer.byteLength(userContent, "utf8"),
          mediaDataUrlBytes: 0,
          sourceWindowKey: null,
          sourceClipCount: 0,
          modelMediaSha256: null,
          modelMediaDataUrl: null,
          mediaStartMs: null,
          mediaEndMs: null,
        },
      };
    }

    const modelContextText = JSON.stringify(
      {
        ...basePrompt,
        liveObservation: true,
      },
      null,
      2,
    );
    const mediaParts = liveCaptureInput.parts.filter((part) => part.type !== "text");
    const livePromptTexts = liveCaptureInput.parts
      .filter((part): part is Extract<(typeof liveCaptureInput.parts)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text.trim())
      .filter((text) => text.length > 0);
    const userText = [
      "Treat the attached video as the primary evidence for this decision.",
      "If the video contradicts recentModelActions or prior context, trust the video.",
      ...livePromptTexts,
      modelContextText,
    ].join("\n\n");

    return {
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            ...mediaParts,
            {
              type: "text",
              text: userText,
            },
          ],
        },
      ],
      requestDebug: {
        promptTextBytes: Buffer.byteLength(userText, "utf8"),
        mediaDataUrlBytes: liveCaptureInput.mediaDataUrlBytes,
        sourceWindowKey: liveCaptureInput.sourceWindowKey,
        sourceClipCount: liveCaptureInput.sourceClipCount,
        modelMediaSha256: liveCaptureInput.modelMediaSha256,
        modelMediaDataUrl: liveCaptureInput.modelMediaDataUrl,
        mediaStartMs: liveCaptureInput.mediaStartMs,
        mediaEndMs: liveCaptureInput.mediaEndMs,
      },
    };
  }
}
