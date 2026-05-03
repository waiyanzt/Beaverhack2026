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
          {
            catalogId: "heart_eyes",
            label: "Heart Eyes",
            description: "Use for love or adorable heart reactions.",
            cueLabels: ["love_reaction"],
            emoteKind: "symbol_effect",
            autoMode: "safe_auto",
          },
          {
            catalogId: "shock_sign",
            label: "Shock Sign",
            description: "Use for clear shocked or surprised expressions.",
            cueLabels: ["shocked", "surprised"],
            emoteKind: "symbol_effect",
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
    recentActionSummary: [],
    cooldowns: {},
    cooldownSummary: {},
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
          confidence: 0.95,
          visualEvidence: "The streamer has a clearly raised hand waving at the camera.",
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
          confidence: 0.95,
          visualEvidence: "The streamer has a clearly raised hand waving at the camera.",
          reason: "repeat test",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("approved");
  });

  it("blocks low-confidence automatic VTS hotkey actions", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:50.220Z")));
    const context = createBaseContext();

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
          actionId: "action_low_confidence",
          catalogId: "greeting",
          catalogVersion: "vts_catalog_demo",
          confidence: 0.72,
          visualEvidence: "The streamer may be moving one hand.",
          reason: "The frame might show a greeting.",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("blocked");
    expect(reviewed?.reason).toContain("confidence");
  });

  it("blocks VTS hotkey actions without concrete visual evidence", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:50.220Z")));
    const context = createBaseContext();

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
          actionId: "action_no_evidence",
          catalogId: "greeting",
          catalogVersion: "vts_catalog_demo",
          confidence: 0.95,
          reason: "Greeting reaction fits.",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("blocked");
    expect(reviewed?.reason).toContain("visual evidence");
  });

  it("blocks heart reactions from smile-only evidence", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:50.220Z")));
    const context = createBaseContext();

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
          actionId: "action_bad_heart",
          catalogId: "heart_eyes",
          catalogVersion: "vts_catalog_demo",
          confidence: 0.96,
          visualEvidence: "The person is smiling widely with braces visible.",
          reason: "A big smile is visible.",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("blocked");
    expect(reviewed?.reason).toContain("smile-only evidence");
  });

  it("blocks shock reactions from neutral or smile evidence", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:50.220Z")));
    const context = createBaseContext();

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
          actionId: "action_bad_shock",
          catalogId: "shock_sign",
          catalogVersion: "vts_catalog_demo",
          confidence: 0.96,
          visualEvidence: "The person has a neutral expression with eyes open.",
          reason: "Visible neutral expression matches shock cue.",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("blocked");
    expect(reviewed?.reason).toContain("neutral or smiling");
  });

  it("allows shock reactions with open mouth and widened eyes evidence", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:50.220Z")));
    const context = createBaseContext();

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "vts.trigger_hotkey",
          actionId: "action_good_shock",
          catalogId: "shock_sign",
          catalogVersion: "vts_catalog_demo",
          confidence: 0.96,
          visualEvidence: "Open mouth and widened eyes are clearly visible.",
          reason: "The current frame shows open mouth plus widened eyes.",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("approved");
  });

  it("blocks noop reasons that clearly support an available automation action", () => {
    const validator = new ActionValidatorService(new CooldownService(() => Date.parse("2026-05-03T08:11:35.220Z")));
    const context = createBaseContext();

    const [reviewed] = validator.reviewActions(
      [
        {
          type: "noop",
          actionId: "noop_1",
          reason: "Current clip clearly matches the greeting cue and visible hello reaction.",
        },
      ],
      context,
      false,
    );

    expect(reviewed?.status).toBe("blocked");
    expect(reviewed?.reason).toContain("Noop reason appears to support");
  });
});
