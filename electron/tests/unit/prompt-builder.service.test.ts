import { describe, expect, it } from "vitest";
import { PromptBuilderService } from "../../src/main/services/automation/prompt-builder.service";
import type { LiveCapturePromptInput } from "../../src/main/services/automation/live-capture-input.service";
import type { ModelControlContext } from "../../src/shared/types/observation.types";

const modelContext: ModelControlContext = {
  tickId: "tick_123",
  timestamp: "2026-05-03T08:00:00.000Z",
  transcript: null,
  services: {
    vts: {
      connected: true,
      authenticated: true,
      currentModelName: "Example Model",
      availableHotkeys: [{ id: "wave", name: "Wave" }],
      automationCatalog: {
        version: "vts_catalog_demo",
        readinessState: "ready",
        readyForAutomation: true,
        safeAutoCount: 1,
        suggestOnlyCount: 0,
        manualOnlyCount: 0,
        candidates: [{ catalogId: "greeting", label: "Wave", intent: "greeting", autoMode: "safe_auto" }],
      },
    },
    obs: {
      connected: true,
      currentScene: "Gameplay",
      streamStatus: "live",
      recordingStatus: "inactive",
      scenes: [{ name: "Gameplay", sources: [{ name: "Webcam", visible: true }] }],
    },
    policy: {
      allowedActions: ["vts.trigger_hotkey", "noop"],
    },
  },
  context: {
    autonomyLevel: "auto_safe",
    recentActions: [],
    recentModelActions: [],
    cooldowns: {},
  },
};

describe("PromptBuilderService", () => {
  it("keeps live video attached and collapses live instructions into a single text part", () => {
    const service = new PromptBuilderService();
    const liveCaptureInput: LiveCapturePromptInput = {
      parts: [
        {
          type: "video_url",
          video_url: {
            url: "data:video/mp4;base64,Zm9v",
          },
        },
        {
          type: "text",
          text: "{\"capture\":true}",
        },
      ],
      promptTextBytes: 16,
      mediaDataUrlBytes: 24,
      sourceWindowKey: "camera:1",
      sourceClipCount: 1,
      modelMediaSha256: "abc123",
      modelMediaDataUrl: "data:video/mp4;base64,Zm9v",
      mediaStartMs: Date.parse("2026-05-03T08:00:00.000Z"),
      mediaEndMs: Date.parse("2026-05-03T08:00:02.000Z"),
    };

    const result = service.buildMessages(modelContext, liveCaptureInput);
    const userMessage = result.messages[1];

    expect(userMessage?.role).toBe("user");
    expect(Array.isArray(userMessage?.content)).toBe(true);
    if (!Array.isArray(userMessage?.content)) {
      return;
    }

    expect(userMessage.content).toHaveLength(2);
    expect(userMessage.content[0]).toEqual({
      type: "video_url",
      video_url: {
        url: "data:video/mp4;base64,Zm9v",
      },
    });
    expect(userMessage.content[1]?.type).toBe("text");
    if (userMessage.content[1]?.type !== "text") {
      return;
    }

    expect(userMessage.content[1].text).toContain("Treat the attached video as the primary evidence");
    expect(userMessage.content[1].text).toContain("{\"capture\":true}");
    expect(userMessage.content[1].text).toContain("\"liveObservation\": true");
    expect(result.requestDebug.mediaDataUrlBytes).toBe(24);
  });
});
