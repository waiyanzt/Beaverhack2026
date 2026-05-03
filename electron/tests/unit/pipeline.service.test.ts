import { describe, expect, it, vi } from "vitest";
import { ActionExecutorService } from "../../src/main/services/automation/action-executor.service";
import { ActionPlanParserService } from "../../src/main/services/automation/action-plan-parser.service";
import { ActionValidatorService } from "../../src/main/services/automation/action-validator.service";
import { CooldownService } from "../../src/main/services/automation/cooldown.service";
import { ModelActionMemoryService } from "../../src/main/services/automation/model-action-memory.service";
import { ObservationBuilderService } from "../../src/main/services/automation/observation-builder.service";
import { PipelineService } from "../../src/main/services/automation/pipeline.service";
import { PromptBuilderService } from "../../src/main/services/automation/prompt-builder.service";
import type { ModelRouterService } from "../../src/main/services/model/model-router.service";

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
        lastError: null,
      }),
      getCachedHotkeys: vi.fn().mockReturnValue([
        { hotkeyID: "laugh", name: "Laugh", type: "TriggerAnimation", description: null, file: null },
      ]),
      triggerHotkey,
    };
    const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
    const modelRouter = {
      createActionPlan: vi.fn().mockResolvedValue({
        actions: [
          {
            type: "vts.trigger_hotkey",
            actionId: "act_001",
            hotkeyId: "laugh",
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
      }),
    } satisfies Pick<ModelRouterService, "createActionPlan">;

    const service = new PipelineService(
      new ObservationBuilderService(obsService, vtsService, cooldownService),
      new PromptBuilderService(),
      modelRouter as ModelRouterService,
      new ActionPlanParserService(),
      new ActionValidatorService(cooldownService),
      new ActionExecutorService(obsService, vtsService, cooldownService),
      cooldownService,
      new ModelActionMemoryService(),
    );

    const result = await service.analyzeNow({
      transcript: "That joke actually got me.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.modelContext.services.vts.availableHotkeys).toEqual([{ id: "laugh", name: "Laugh" }]);
    expect(result.modelContext.services.policy.allowedActions).toContain("vts.trigger_hotkey");
    expect(result.reviewedActions[0]?.status).toBe("approved");
    expect(result.actionResults[0]?.status).toBe("executed");
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
        lastError: null,
      }),
      getCachedHotkeys: vi.fn().mockReturnValue([]),
      triggerHotkey: vi.fn(),
    };
    const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
    const modelRouter = {
      createActionPlan: vi.fn().mockResolvedValue({
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
      }),
    } satisfies Pick<ModelRouterService, "createActionPlan">;

    const service = new PipelineService(
      new ObservationBuilderService(obsService, vtsService, cooldownService),
      new PromptBuilderService(),
      modelRouter as ModelRouterService,
      new ActionPlanParserService(),
      new ActionValidatorService(cooldownService),
      new ActionExecutorService(obsService, vtsService, cooldownService),
      cooldownService,
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
        lastError: null,
      }),
      getCachedHotkeys: vi.fn().mockReturnValue([]),
      triggerHotkey: vi.fn(),
    };
    const cooldownService = new CooldownService(() => Date.parse("2026-05-02T10:00:00.000Z"));
    const modelRouter = {
      createActionPlan: vi.fn().mockResolvedValue({
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
      }),
    } satisfies Pick<ModelRouterService, "createActionPlan">;

    const service = new PipelineService(
      new ObservationBuilderService(obsService, vtsService, cooldownService),
      new PromptBuilderService(),
      modelRouter as ModelRouterService,
      new ActionPlanParserService(),
      new ActionValidatorService(cooldownService),
      new ActionExecutorService(obsService, vtsService, cooldownService),
      cooldownService,
      new ModelActionMemoryService(),
    );

    await service.analyzeNow();
    const secondResult = await service.analyzeNow();

    const secondCallMessages = modelRouter.createActionPlan.mock.calls[1]?.[0];
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
});
