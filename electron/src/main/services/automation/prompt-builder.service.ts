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
  public buildIntentMessages(
    modelContext: ModelControlContext,
    liveCaptureInput?: LiveCapturePromptInput,
  ): PromptBuildResult {
    const systemPrompt = `${loadPrompt("intent-system").content}\n\n${loadPrompt("intent-planner").content}`;

    const intentCatalog = [
      {
        catalogId: "__builtin_neutral__",
        intent: "neutral",
        label: "Neutral / Idle",
        description: "No reaction needed. The streamer is idle, resting, or nothing notable is happening.",
      },
      ...modelContext.services.vts.automationCatalog.candidates.map((c) => ({
        catalogId: c.catalogId,
        intent: c.intent,
        label: c.label,
        description: c.description,
      })),
    ];

    const basePrompt = {
      instructions: [
        "Classify the scene into exactly one intent from the availableIntents below.",
        "Use 'neutral' when nothing notable is happening. Only pick a reaction intent when you clearly observe the matching visual cues.",
        "You MUST always pick an intent. Do not skip.",
      ],
      availableIntents: intentCatalog,
      recentActions: modelContext.context.recentActions.slice(0, 2),
    };

    if (!liveCaptureInput) {
      const userContent = JSON.stringify(basePrompt);

      return {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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

    const modelContextText = JSON.stringify(basePrompt);
    const mediaParts = liveCaptureInput.parts.filter((part) => part.type !== "text");
    const userText = [
      "Treat the attached images as the primary evidence.",
      modelContextText,
    ].join("\n\n");

    return {
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            ...mediaParts,
            { type: "text", text: userText },
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
      const userContent = JSON.stringify(basePrompt);

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
    );
    const mediaParts = liveCaptureInput.parts.filter((part) => part.type !== "text");
    const livePromptTexts = liveCaptureInput.parts
      .filter((part): part is Extract<(typeof liveCaptureInput.parts)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text.trim())
      .filter((text) => text.length > 0);
    const userText = [
      "Treat the attached images as the primary evidence for this decision. These are sequential frames from a 2-second webcam clip captured ~200ms apart.",
      "If the images contradict recentModelActions or prior context, trust the images.",
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
