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
        "Here are the current stream controls, observation context, cooldown state, and compact recent action summaries.",
        "Use recentActionSummary only to avoid rapid repetition. Do not copy prior action reasons or prior blocked outcomes into the current decision.",
        "Do not infer cooldowns from recentActionSummary or recentActions. Only treat a catalog item as cooling down when cooldownSummary[catalogId].remainingMs is greater than 0.",
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
      "If the video contradicts recent history or prior context, trust the video.",
      "If the current clip clearly matches exactly one safe_auto catalog candidate and cooldownSummary for that catalog item is 0 or missing, prefer that action over noop.",
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
