import { describe, expect, it, vi } from "vitest";
import { ActionExecutorService } from "../../src/main/services/automation/action-executor.service";
import { ActionPlanParserService } from "../../src/main/services/automation/action-plan-parser.service";
import { ActionValidatorService } from "../../src/main/services/automation/action-validator.service";
import { CooldownService } from "../../src/main/services/automation/cooldown.service";
import { LiveCaptureInputService } from "../../src/main/services/automation/live-capture-input.service";
import { ModelActionMemoryService } from "../../src/main/services/automation/model-action-memory.service";
import { ObservationBuilderService } from "../../src/main/services/automation/observation-builder.service";
import { PipelineService } from "../../src/main/services/automation/pipeline.service";
import { PromptBuilderService } from "../../src/main/services/automation/prompt-builder.service";
import type { ModelRouterService } from "../../src/main/services/model/model-router.service";

const createLiveCaptureInputService = (): LiveCaptureInputService =>
  ({
    buildPromptInput: vi.fn(),
  }) as unknown as LiveCaptureInputService;

describe("PipelineService", () => {
  it("builds service context, validates a VTS hotkey action, and executes it", async () => {
    const triggerHotkey = vi.fn().mockResolvedValue("laugh");
    const obsService = {
      getStatus: vi.fn().mockResolvedValue({
        connected: true as const,
        currentScene: "Gameplay",
        streamStatus: "live" as const,
        recordingStatus: "inactive" as const,
        scenes: [
          {
            name: "Gameplay",
            sources: [
              { name: "Game Capture", visible: true },
              { name: "Webcam", visible: true },
            ],
          },
        ],
      }),
      setCurrentScene: vi.fn(),
      setSourceVisibility: vi.fn(),
    };
    const vtsService = {
      getStatus: vi.fn().mockReturnValue({
        connectionState: "connected" as const,
        authenticationState: "authenticated" as const,
        readinessState: "ready" as const,
        readyForAutomation: true,
        connected: true,
        authenticated: true,
        config: {
          host: "127.0.0.1",
          port: 8001,
          pluginName: "AuTuber",
          pluginDeveloper: "AuTuber",
        },
        modelLoaded: true,
        modelName: "Example Model",
        modelId: "model-1",
        hotkeyCount: 1,
        catalog: {
          version: "vts_catalog_demo",
          hotkeyHash: "demo",
          totalEntries: 1,
          safeAutoCount: 1,
          suggestOnlyCount: 0,
          manualOnlyCount: 0,
          entries: [
            {
              catalogId: "laugh",
              hotkeyId: "laugh",
              hotkeyName: "Laugh",
              promptName: "laugh",
              promptDescription: "Use when the streamer laughs or tells a joke.",
              normalizedName: "laugh",
              cueLabels: ["laughing"],
              emoteKind: "expression_reaction" as const,
              autoMode: "safe_auto" as const,
              confidence: 0.9,
              hasAutoDeactivate: false,
              manualDeactivateAfterMs: 5000,
              generatedClassification: {
                cueLabels: ["laughing"],
                emoteKind: "expression_reaction" as const,
                autoMode: "safe_auto" as const,
                confidence: 0.9,
                source: "model" as const,
              },
              override: null,
              effectiveSource: "model" as const,
            },
          ],
        },
        lastError: null,
      }),
      getCachedHotkeys: vi.fn().mockReturnValue([
        { hotkeyID: "laugh", name: "Laugh", type: "TriggerAnimation", description: null, file: null },
      ]),
      resolveCatalogEntry: vi.fn().mockReturnValue({
        catalogId: "laugh",
        hotkeyId: "laugh",
        hasAutoDeactivate: false,
        manualDeactivateAfterMs: 5000,
      }),
      triggerHotkey,
    };
    const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
    const modelRouter = {
      requestActionPlan: vi.fn().mockResolvedValue({
        providerId: "mock",
        ok: true,
        status: 200,
        content: "ok",
        actionPlan: {
          actions: [
            {
              type: "vts.trigger_hotkey",
              actionId: "act_001",
              catalogId: "laugh",
              catalogVersion: "vts_catalog_demo",
              reason: "Streamer made a funny joke and laugh reaction fits.",
              cooldownMs: 5000,
            },
          ],
          safety: {
            riskLevel: "low",
            requiresConfirmation: false,
          },
          nextTick: {
            suggestedDelayMs: 5000,
            priority: "normal",
          },
        },
      }),
    } satisfies Pick<ModelRouterService, "requestActionPlan">;

    const service = new PipelineService(
      new ObservationBuilderService(obsService, vtsService, cooldownService),
      new PromptBuilderService(),
      modelRouter as ModelRouterService,
      new ActionPlanParserService(),
      new ActionValidatorService(cooldownService),
      new ActionExecutorService(obsService, vtsService, cooldownService),
      cooldownService,
      createLiveCaptureInputService(),
      new ModelActionMemoryService(),
    );

    const result = await service.analyzeNow({
      transcript: "That joke actually got me.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.modelContext.services.vts.availableHotkeys).toEqual([]);
    expect(result.modelContext.services.vts.automationCatalog.candidates).toEqual([
      {
        catalogId: "laugh",
        label: "laugh",
        description: "Use when the streamer laughs or tells a joke.",
        cueLabels: ["laughing"],
        emoteKind: "expression_reaction",
        autoMode: "safe_auto",
      },
    ]);
    expect(result.modelContext.services.policy.allowedActions).toContain("vts.trigger_hotkey");
    expect(result.reviewedActions[0]?.status).toBe("approved");
    expect(result.actionResults[0]?.status).toBe("executed");
    expect(result.modelContext.context.recentActions[0]).toMatchObject({
      type: "vts.trigger_hotkey",
      target: "vts.catalog:laugh",
      label: "VTS catalog: laugh",
    });
    expect(triggerHotkey).toHaveBeenCalledWith("laugh");
  });

  it("holds OBS scene changes for confirmation", async () => {
    const obsService = {
      getStatus: vi.fn().mockResolvedValue({
        connected: true as const,
        currentScene: "Gameplay",
        streamStatus: "live" as const,
        recordingStatus: "inactive" as const,
        scenes: [
          {
            name: "Gameplay",
            sources: [],
          },
          {
            name: "BRB",
            sources: [{ name: "BRB Screen", visible: true }],
          },
        ],
      }),
      setCurrentScene: vi.fn(),
      setSourceVisibility: vi.fn(),
    };
    const vtsService = {
      getStatus: vi.fn().mockReturnValue({
        connectionState: "disconnected" as const,
        authenticationState: "unauthenticated" as const,
        readinessState: "not_running" as const,
        readyForAutomation: false,
        connected: false,
        authenticated: false,
        config: {
          host: "127.0.0.1",
          port: 8001,
          pluginName: "AuTuber",
          pluginDeveloper: "AuTuber",
        },
        modelLoaded: false,
        modelName: null,
        modelId: null,
        hotkeyCount: 0,
        catalog: {
          version: null,
          hotkeyHash: null,
          totalEntries: 0,
          safeAutoCount: 0,
          suggestOnlyCount: 0,
          manualOnlyCount: 0,
          entries: [],
        },
        lastError: null,
      }),
      getCachedHotkeys: vi.fn().mockReturnValue([]),
      resolveCatalogEntry: vi.fn().mockReturnValue(null),
      triggerHotkey: vi.fn(),
    };
    const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
    const modelRouter = {
      requestActionPlan: vi.fn().mockResolvedValue({
        providerId: "mock",
        ok: true,
        status: 200,
        content: "ok",
        actionPlan: {
          actions: [
            {
              type: "obs.set_scene",
              actionId: "act_switch_brb_001",
              sceneName: "BRB",
              reason: "Streamer appears to have stepped away.",
            },
          ],
          safety: {
            riskLevel: "medium",
            requiresConfirmation: true,
            reason: "Changing OBS scenes affects the live stream.",
          },
          nextTick: {
            suggestedDelayMs: 5000,
            priority: "normal",
          },
        },
      }),
    } satisfies Pick<ModelRouterService, "requestActionPlan">;

    const service = new PipelineService(
      new ObservationBuilderService(obsService, vtsService, cooldownService),
      new PromptBuilderService(),
      modelRouter as ModelRouterService,
      new ActionPlanParserService(),
      new ActionValidatorService(cooldownService),
      new ActionExecutorService(obsService, vtsService, cooldownService),
      cooldownService,
      createLiveCaptureInputService(),
      new ModelActionMemoryService(),
    );

    const result = await service.analyzeNow();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reviewedActions[0]?.status).toBe("confirmation_required");
    expect(result.actionResults[0]?.status).toBe("confirmation_required");
    expect(obsService.setCurrentScene).not.toHaveBeenCalled();
  });

  it("includes recent model action plans in the next model prompt", async () => {
    const obsService = {
      getStatus: vi.fn().mockResolvedValue({
        connected: false as const,
        currentScene: null,
        streamStatus: "inactive" as const,
        recordingStatus: "inactive" as const,
        scenes: [],
      }),
      setCurrentScene: vi.fn(),
      setSourceVisibility: vi.fn(),
    };
    const vtsService = {
      getStatus: vi.fn().mockReturnValue({
        connectionState: "disconnected" as const,
        authenticationState: "unauthenticated" as const,
        readinessState: "not_running" as const,
        readyForAutomation: false,
        connected: false,
        authenticated: false,
        config: {
          host: "127.0.0.1",
          port: 8001,
          pluginName: "AuTuber",
          pluginDeveloper: "AuTuber",
        },
        modelLoaded: false,
        modelName: null,
        modelId: null,
        hotkeyCount: 0,
        catalog: {
          version: null,
          hotkeyHash: null,
          totalEntries: 0,
          safeAutoCount: 0,
          suggestOnlyCount: 0,
          manualOnlyCount: 0,
          entries: [],
        },
        lastError: null,
      }),
      getCachedHotkeys: vi.fn().mockReturnValue([]),
      resolveCatalogEntry: vi.fn().mockReturnValue(null),
      triggerHotkey: vi.fn(),
    };
    const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
    const modelRouter = {
      requestActionPlan: vi.fn().mockResolvedValue({
        providerId: "mock",
        ok: true,
        status: 200,
        content: "ok",
        actionPlan: {
          actions: [
            {
              type: "noop",
              actionId: "act_memory_001",
              reason: "No contextual action is needed.",
            },
          ],
          safety: {
            riskLevel: "low",
            requiresConfirmation: false,
            reason: "No stream-changing action was requested.",
          },
          nextTick: {
            suggestedDelayMs: 5000,
            priority: "normal",
          },
        },
      }),
    } satisfies Pick<ModelRouterService, "requestActionPlan">;

    const service = new PipelineService(
      new ObservationBuilderService(obsService, vtsService, cooldownService),
      new PromptBuilderService(),
      modelRouter as ModelRouterService,
      new ActionPlanParserService(),
      new ActionValidatorService(cooldownService),
      new ActionExecutorService(obsService, vtsService, cooldownService),
      cooldownService,
      createLiveCaptureInputService(),
      new ModelActionMemoryService(),
    );

    await service.analyzeNow();
    const secondResult = await service.analyzeNow();

    const secondCallMessages = vi.mocked(modelRouter.requestActionPlan).mock.calls[1]?.[0];
    const userMessage = secondCallMessages?.find((message) => message.role === "user");
    expect(typeof userMessage?.content).toBe("string");
    const payload = JSON.parse(userMessage?.content as string) as {
      modelContext: {
        context: {
          recentModelActions: Array<{
            actionPlan: {
              actions: Array<{ actionId: string; reason: string }>;
              safety: { reason?: string };
            };
          }>;
        };
      };
    };

    expect(payload.modelContext.context.recentModelActions).toHaveLength(1);
    expect(payload.modelContext.context.recentModelActions[0]?.actionPlan.actions[0]).toMatchObject({
      actionId: "act_memory_001",
      reason: "No contextual action is needed.",
    });
    expect(payload.modelContext.context.recentModelActions[0]?.actionPlan.safety.reason).toBe(
      "No stream-changing action was requested.",
    );
    expect(secondResult.ok).toBe(true);
    if (!secondResult.ok) {
      return;
    }
    expect(secondResult.modelContext.context.recentActions[0]).toMatchObject({
      actionId: "act_memory_001",
      type: "noop",
      target: "noop",
    });
  });

  it("builds a live-capture prompt and disables OBS actions for VTS-only monitor runs", async () => {
    const triggerHotkey = vi.fn().mockResolvedValue("wave");
    const obsService = {
      getStatus: vi.fn().mockResolvedValue({
        connected: true as const,
        currentScene: "Gameplay",
        streamStatus: "live" as const,
        recordingStatus: "inactive" as const,
        scenes: [{ name: "Gameplay", sources: [{ name: "Webcam", visible: true }] }],
      }),
      setCurrentScene: vi.fn(),
      setSourceVisibility: vi.fn(),
    };
    const vtsService = {
      getStatus: vi.fn().mockReturnValue({
        connectionState: "connected" as const,
        authenticationState: "authenticated" as const,
        readinessState: "ready" as const,
        readyForAutomation: true,
        connected: true,
        authenticated: true,
        config: {
          host: "127.0.0.1",
          port: 8001,
          pluginName: "AuTuber",
          pluginDeveloper: "AuTuber",
        },
        modelLoaded: true,
        modelName: "Example Model",
        modelId: "model-1",
        hotkeyCount: 1,
        catalog: {
          version: "vts_catalog_demo",
          hotkeyHash: "demo",
          totalEntries: 1,
          safeAutoCount: 1,
          suggestOnlyCount: 0,
          manualOnlyCount: 0,
          entries: [
            {
              catalogId: "greeting",
              hotkeyId: "wave",
              hotkeyName: "Wave",
              promptName: "wave",
              promptDescription: "Use when the streamer waves or greets chat.",
              normalizedName: "wave",
              cueLabels: ["greeting", "wave"],
              emoteKind: "body_motion" as const,
              autoMode: "safe_auto" as const,
              confidence: 0.8,
              hasAutoDeactivate: false,
              manualDeactivateAfterMs: 5000,
              generatedClassification: {
                cueLabels: ["greeting", "wave"],
                emoteKind: "body_motion" as const,
                autoMode: "safe_auto" as const,
                confidence: 0.8,
                source: "model" as const,
              },
              override: null,
              effectiveSource: "model" as const,
            },
          ],
        },
        lastError: null,
      }),
      getCachedHotkeys: vi.fn().mockReturnValue([
        { hotkeyID: "wave", name: "Wave", type: "TriggerAnimation", description: null, file: null },
      ]),
      resolveCatalogEntry: vi.fn().mockReturnValue({
        catalogId: "greeting",
        hotkeyId: "wave",
        hasAutoDeactivate: false,
        manualDeactivateAfterMs: 5000,
      }),
      triggerHotkey,
    };
    const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
    const modelRouter = {
      requestActionPlan: vi.fn().mockResolvedValue({
        providerId: "mock",
        ok: true,
        status: 200,
        content: "ok",
        actionPlan: {
          actions: [
            {
              type: "vts.trigger_hotkey",
              actionId: "act_002",
              catalogId: "greeting",
              catalogVersion: "vts_catalog_demo",
              reason: "Streamer waved at the camera.",
            },
          ],
          safety: {
            riskLevel: "low",
            requiresConfirmation: false,
          },
          nextTick: {
            suggestedDelayMs: 1000,
            priority: "high",
          },
        },
      }),
    } satisfies Pick<ModelRouterService, "requestActionPlan">;
    const liveCaptureInputService = {
      buildPromptInput: vi.fn().mockResolvedValue({
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
        sourceWindowKey: "camera:1:2000:video/webm:audio:none",
        sourceClipCount: 1,
        modelMediaSha256: "abc123",
        modelMediaDataUrl: "data:video/mp4;base64,Zm9v",
        mediaStartMs: Date.parse("2026-05-02T10:00:00.000Z"),
        mediaEndMs: Date.parse("2026-05-02T10:00:02.000Z"),
      }),
    } as unknown as LiveCaptureInputService;

    const service = new PipelineService(
      new ObservationBuilderService(obsService, vtsService, cooldownService),
      new PromptBuilderService(),
      modelRouter as ModelRouterService,
      new ActionPlanParserService(),
      new ActionValidatorService(cooldownService),
      new ActionExecutorService(obsService, vtsService, cooldownService),
      cooldownService,
      liveCaptureInputService,
      new ModelActionMemoryService(),
    );

    const result = await service.analyzeNow({
      useLatestCapture: true,
      captureWindowMs: 2_000,
      allowObsActions: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const sentMessages = vi.mocked(modelRouter.requestActionPlan).mock.calls[0]?.[0];
    const userMessage = sentMessages?.find((message) => message.role === "user");
    expect(Array.isArray(userMessage?.content)).toBe(true);
    if (!Array.isArray(userMessage?.content)) {
      return;
    }
    const promptTextPart = userMessage.content.find((part) => part.type === "text");
    expect(promptTextPart?.type).toBe("text");
    if (promptTextPart?.type !== "text") {
      return;
    }
    const promptPayload = JSON.parse(promptTextPart.text.split("\n\n").at(-1) ?? "{}") as {
      modelContext: {
        context: {
          recentActions: unknown[];
          recentModelActions: unknown[];
        };
      };
    };

    expect(liveCaptureInputService.buildPromptInput).toHaveBeenCalledWith(2_000);
    expect(result.modelContext.services.policy.allowedActions).not.toContain("obs.set_scene");
    expect(result.modelContext.services.policy.allowedActions).toContain("vts.trigger_hotkey");
    expect(result.requestDebug.modelMediaDataUrl).toBe("data:video/mp4;base64,Zm9v");
    expect(promptPayload.modelContext.context.recentActions).toEqual([]);
    expect(promptPayload.modelContext.context.recentModelActions).toEqual([]);
    expect(triggerHotkey).toHaveBeenCalledWith("wave");
  });
});
