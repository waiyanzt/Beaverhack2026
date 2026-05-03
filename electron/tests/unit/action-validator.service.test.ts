import { describe, expect, it } from "vitest";
import { ActionValidatorService } from "../../src/main/services/automation/action-validator.service";
import { CooldownService } from "../../src/main/services/automation/cooldown.service";
import type { ModelControlContext } from "../../src/shared/types/observation.types";

const createBaseContext = (): ModelControlContext => ({
  tickId: "tick_1",
  timestamp: "2026-05-03T08:11:35.220Z",
  transcript: null,
  services: {
    vts: {
      connected: true,
      authenticated: true,
      currentModelName: "zane1",
      availableHotkeys: [],
      automationCatalog: {
        version: "vts_catalog_demo",
        readinessState: "ready",
        readyForAutomation: true,
        safeAutoCount: 1,
        suggestOnlyCount: 0,
        manualOnlyCount: 0,
        candidates: [
          {
            catalogId: "greeting",
            label: "hello",
            description: "Use when the streamer greets chat.",
            cueLabels: ["greeting", "wave"],
            emoteKind: "expression_reaction",
            autoMode: "safe_auto",
          },
        ],
      },
    },
    obs: {
      connected: true,
      currentScene: "Scene",
      streamStatus: "inactive",
      recordingStatus: "inactive",
      scenes: [{ name: "Scene", sources: [] }],
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
});

describe("ActionValidatorService", () => {
  it("blocks raw VTS hotkey actions that do not use the automation catalog", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:35.220Z")));
    const context = createBaseContext();

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
          actionId: "action_legacy",
          hotkeyId: "hotkey_hi",
          reason: "legacy format",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("blocked");
    expect(reviewed?.reason).toContain("must use a catalogId");
  });

  it("blocks a repeated VTS hotkey inside the default repeat window", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:35.220Z")));
    const context = createBaseContext();
    context.context.recentActions = [
      {
        actionId: "action_11",
        type: "vts.trigger_hotkey",
        target: "vts.catalog:greeting",
        label: "VTS catalog: greeting",
        timestamp: "2026-05-03T08:11:31.075Z",
      },
    ];

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
        actionId: "action_12",
          catalogId: "greeting",
          catalogVersion: "vts_catalog_demo",
          reason: "repeat test",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("blocked");
    expect(reviewed?.reason).toContain("already triggered recently");
  });

  it("allows a VTS hotkey again after the repeat window elapses", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:50.220Z")));
    const context = createBaseContext();
    context.timestamp = "2026-05-03T08:11:50.220Z";
    context.context.recentActions = [
      {
        actionId: "action_11",
        type: "vts.trigger_hotkey",
        target: "vts.catalog:greeting",
        label: "VTS catalog: greeting",
        timestamp: "2026-05-03T08:11:31.075Z",
      },
    ];

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
        actionId: "action_12",
          catalogId: "greeting",
          catalogVersion: "vts_catalog_demo",
          reason: "repeat test",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("approved");
  });
});
