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
import { DEFAULT_VTS_CUE_LABELS } from "../../src/shared/vts-cue-labels";

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
        cueLabels: DEFAULT_VTS_CUE_LABELS,
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
              confidence: 0.94,
              visualEvidence: "The streamer is visibly laughing with an open smile.",
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
    expect(result.modelContext.context.recentActionSummary[0]).toMatchObject({
      catalogId: "laugh",
      actionType: "vts.trigger_hotkey",
      status: "executed",
    });
    expect(result.modelContext.context.recentActionSummary[0]?.ageMs).toBeGreaterThanOrEqual(0);
    expect(result.modelContext.context.cooldownSummary).toEqual({
      laugh: {
        remainingMs: 5000,
      },
    });
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
        cueLabels: DEFAULT_VTS_CUE_LABELS,
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
        cueLabels: DEFAULT_VTS_CUE_LABELS,
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
          recentActionSummary: Array<{
            actionType: string;
            status: string;
          }>;
        };
      };
    };

    expect(payload.modelContext.context.recentModelActions).toHaveLength(1);
    expect(payload.modelContext.context.recentActionSummary).toEqual([]);
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
        cueLabels: DEFAULT_VTS_CUE_LABELS,
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
              cueLabels: ["greeting", "wave"],
              confidence: 0.93,
              visualEvidence: "The streamer has a clearly raised hand waving at the camera.",
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
          recentActionSummary: unknown[];
        };
        services: {
          vts: {
            automationCatalog: {
              candidates: unknown[];
            };
          };
        };
      };
    };

    expect(liveCaptureInputService.buildPromptInput).toHaveBeenCalledWith(2_000, "clip", ["greeting", "wave"]);
    expect(result.modelContext.services.policy.allowedActions).not.toContain("obs.set_scene");
    expect(result.modelContext.services.policy.allowedActions).toContain("vts.trigger_hotkey");
    expect(result.requestDebug.modelMediaDataUrl).toBe("data:video/mp4;base64,Zm9v");
    expect(promptPayload.modelContext.context.recentActions).toEqual([]);
    expect(promptPayload.modelContext.context.recentModelActions).toEqual([]);
    expect(promptPayload.modelContext.context.recentActionSummary).toEqual([]);
    expect(promptPayload.modelContext.services.vts.automationCatalog.candidates).toEqual([]);
    expect(result.plan.actions[0]).toMatchObject({
      type: "vts.trigger_hotkey",
      catalogId: "greeting",
      cueLabels: ["greeting", "wave"],
    });
    expect(triggerHotkey).toHaveBeenCalledWith("wave");
  });

  describe("vacancy detection", () => {
    const createObsService = () => ({
      getStatus: vi.fn().mockResolvedValue({
        connected: true as const,
        currentScene: "Main",
        streamStatus: "live" as const,
        recordingStatus: "inactive" as const,
        scenes: [
          { name: "Main", sources: [{ name: "BRB Overlay", visible: false }] },
        ],
      }),
      setCurrentScene: vi.fn(),
      setSourceVisibility: vi.fn().mockResolvedValue(undefined),
    });

    const createVtsService = () => ({
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
    });

    const createModelRouter = () => ({
      requestActionPlan: vi.fn().mockResolvedValue({
        providerId: "mock",
        ok: true,
        status: 200,
        content: "ok",
        actionPlan: {
          actions: [
            {
              type: "noop",
              actionId: "act_noop_001",
              reason: "Streamer is idle.",
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
    }) satisfies { requestActionPlan: ReturnType<typeof vi.fn> };

    it("injects a show-BRB OBS action when the model returns a vacant cue", async () => {
      const obsService = createObsService();
      const vtsService = createVtsService();
      const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
      const now = Date.parse("2026-05-02T10:00:00.000Z");
      vi.spyOn(Date, "now").mockReturnValue(now);
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
                actionId: "act_vacant_001",
                cueLabels: ["vacant"],
                confidence: 0.95,
                visualEvidence: "Camera is covered; no person is visible.",
                reason: "Streamer has stepped away from the camera.",
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
        { sourceName: "BRB Overlay", vacantEnterDelayMs: 0 },
      );

      let result = await service.analyzeNow();
      expect(result.ok).toBe(true);
      result = await service.analyzeNow();

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.reviewedActions.length).toBeGreaterThanOrEqual(1);
      const vacancyAction = result.reviewedActions.find((a) => a.action.type === "obs.set_source_visibility");
      expect(vacancyAction).toBeDefined();
      if (!vacancyAction || vacancyAction.action.type !== "obs.set_source_visibility") {
        return;
      }
      expect(vacancyAction.status).toBe("approved");
      expect(vacancyAction.action.sceneName).toBe("Main");
      expect(vacancyAction.action.sourceName).toBe("BRB Overlay");
      expect(vacancyAction.action.visible).toBe(true);
      expect(obsService.setSourceVisibility).toHaveBeenCalledWith("Main", "BRB Overlay", true);
    });

    it("does not inject a duplicate show-BRB action when already vacant", async () => {
      const obsService = createObsService();
      const vtsService = createVtsService();
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
                actionId: "act_vacant_001",
                cueLabels: ["vacant"],
                confidence: 0.95,
                visualEvidence: "Camera is covered; no person is visible.",
                reason: "Streamer has stepped away from the camera.",
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
        { sourceName: "BRB Overlay", vacantEnterDelayMs: 0 },
      );

      await service.analyzeNow();
      vi.mocked(Date.now).mockReturnValue(Date.parse("2026-05-02T10:00:10.000Z"));
      await service.analyzeNow();
      const callsAfterFirstTick = vi.mocked(obsService.setSourceVisibility).mock.calls.length;
      vi.mocked(obsService.setSourceVisibility).mockClear();

      await service.analyzeNow();
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();
    });

    it("injects a hide-BRB OBS action when the model returns a non-vacant action after being vacant", async () => {
      const obsService = createObsService();
      const vtsService = createVtsService();
      const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
      const startMs = Date.parse("2026-05-02T10:00:00.000Z");
      let fakeNow = startMs;
      vi.spyOn(Date, "now").mockImplementation(() => fakeNow);

      const modelRouter = {
        requestActionPlan: vi
          .fn()
          .mockResolvedValueOnce({
            providerId: "mock",
            ok: true,
            status: 200,
            content: "ok",
            actionPlan: {
              actions: [
                {
                  type: "vts.trigger_hotkey",
                  actionId: "act_vacant_001",
                  cueLabels: ["vacant"],
                  confidence: 0.95,
                  visualEvidence: "Camera is covered; no person is visible.",
                  reason: "Streamer has stepped away.",
                },
              ],
              safety: { riskLevel: "low", requiresConfirmation: false },
              nextTick: { suggestedDelayMs: 5000, priority: "normal" },
            },
          })
          .mockResolvedValueOnce({
            providerId: "mock",
            ok: true,
            status: 200,
            content: "ok",
            actionPlan: {
              actions: [
                {
                  type: "vts.trigger_hotkey",
                  actionId: "act_vacant_002",
                  cueLabels: ["vacant"],
                  confidence: 0.95,
                  visualEvidence: "Camera still covered.",
                  reason: "Still no person.",
                },
              ],
              safety: { riskLevel: "low", requiresConfirmation: false },
              nextTick: { suggestedDelayMs: 5000, priority: "normal" },
            },
          })
          .mockResolvedValueOnce({
            providerId: "mock",
            ok: true,
            status: 200,
            content: "ok",
            actionPlan: {
              actions: [
                {
                  type: "noop",
                  actionId: "act_noop_002",
                  reason: "Streamer is back and idle.",
                },
              ],
              safety: { riskLevel: "low", requiresConfirmation: false },
              nextTick: { suggestedDelayMs: 5000, priority: "normal" },
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
        { sourceName: "BRB Overlay", vacantEnterDelayMs: 5_000 },
      );

      const result1 = await service.analyzeNow();
      expect(result1.ok).toBe(true);
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();

      fakeNow = startMs + 5_000;
      const result2 = await service.analyzeNow();
      expect(result2.ok).toBe(true);
      expect(obsService.setSourceVisibility).toHaveBeenCalledWith("Main", "BRB Overlay", true);
      vi.mocked(obsService.setSourceVisibility).mockClear();

      fakeNow = startMs + 10_000;
      const result3 = await service.analyzeNow();

      expect(result3.ok).toBe(true);
      if (!result3.ok) {
        return;
      }
      const vacancyAction = result3.reviewedActions.find((a) => a.action.type === "obs.set_source_visibility");
      expect(vacancyAction).toBeDefined();
      if (!vacancyAction || vacancyAction.action.type !== "obs.set_source_visibility") {
        return;
      }
      expect(vacancyAction.status).toBe("approved");
      expect(vacancyAction.action.visible).toBe(false);
      expect(obsService.setSourceVisibility).toHaveBeenCalledWith("Main", "BRB Overlay", false);
    });

    it("does not inject a show-BRB action until debounce delay elapses", async () => {
      const obsService = createObsService();
      const vtsService = createVtsService();
      const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
      const startMs = Date.parse("2026-05-02T10:00:00.000Z");
      let fakeNow = startMs;
      vi.spyOn(Date, "now").mockImplementation(() => fakeNow);
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
                actionId: "act_vacant_001",
                cueLabels: ["vacant"],
                confidence: 0.95,
                visualEvidence: "Camera is covered; no person is visible.",
                reason: "Streamer has stepped away from the camera.",
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
        { sourceName: "BRB Overlay", vacantEnterDelayMs: 5_000 },
      );

      await service.analyzeNow();
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();

      fakeNow = startMs + 2_000;
      await service.analyzeNow();
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();

      fakeNow = startMs + 5_000;
      await service.analyzeNow();
      expect(obsService.setSourceVisibility).toHaveBeenCalledWith("Main", "BRB Overlay", true);

      vi.mocked(obsService.setSourceVisibility).mockClear();

      fakeNow = startMs + 7_000;
      await service.analyzeNow();
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();
    });

    it("suppresses vacancy OBS actions during dry run", async () => {
      const obsService = createObsService();
      const vtsService = createVtsService();
      const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
      const startMs = Date.parse("2026-05-02T10:00:00.000Z");
      let fakeNow = startMs;
      vi.spyOn(Date, "now").mockImplementation(() => fakeNow);

      const modelRouter = {
        requestActionPlan: vi
          .fn()
          .mockResolvedValueOnce({
            providerId: "mock",
            ok: true,
            status: 200,
            content: "ok",
            actionPlan: {
              actions: [
                {
                  type: "vts.trigger_hotkey",
                  actionId: "act_vacant_001",
                  cueLabels: ["vacant"],
                  confidence: 0.95,
                  visualEvidence: "Camera is covered.",
                  reason: "No person.",
                },
              ],
              safety: { riskLevel: "low", requiresConfirmation: false },
              nextTick: { suggestedDelayMs: 5000, priority: "normal" },
            },
          })
          .mockResolvedValueOnce({
            providerId: "mock",
            ok: true,
            status: 200,
            content: "ok",
            actionPlan: {
              actions: [
                {
                  type: "vts.trigger_hotkey",
                  actionId: "act_vacant_002",
                  cueLabels: ["vacant"],
                  confidence: 0.95,
                  visualEvidence: "Still covered.",
                  reason: "Still no person.",
                },
              ],
              safety: { riskLevel: "low", requiresConfirmation: false },
              nextTick: { suggestedDelayMs: 5000, priority: "normal" },
            },
          })
          .mockResolvedValueOnce({
            providerId: "mock",
            ok: true,
            status: 200,
            content: "ok",
            actionPlan: {
              actions: [
                {
                  type: "noop",
                  actionId: "act_noop_002",
                  reason: "User back.",
                },
              ],
              safety: { riskLevel: "low", requiresConfirmation: false },
              nextTick: { suggestedDelayMs: 5000, priority: "normal" },
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
        { sourceName: "BRB Overlay", vacantEnterDelayMs: 5_000 },
      );

      await service.analyzeNow({ dryRun: true });
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();

      fakeNow = startMs + 5_000;
      await service.analyzeNow({ dryRun: true });
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();

      fakeNow = startMs + 10_000;
      await service.analyzeNow({ dryRun: true });
      expect(obsService.setSourceVisibility).not.toHaveBeenCalled();
    });
  });
});
