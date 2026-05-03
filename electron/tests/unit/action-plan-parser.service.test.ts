import { describe, expect, it } from "vitest";
import { ActionPlanParserService } from "../../src/main/services/automation/action-plan-parser.service";

describe("ActionPlanParserService", () => {
  it("fills in missing top-level metadata for otherwise valid plans", () => {
    const parser = new ActionPlanParserService();

    const plan = parser.parse({
      actions: [
        {
          type: "noop",
          actionId: "act_1",
          reason: "No action required.",
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
    });

    expect(plan.schemaVersion).toBe("2026-05-02");
    expect(plan.tickId).toMatch(/^tick_/);
    expect(plan.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("normalizes empty action arrays to explicit noop and clamps unsafe next tick delays", () => {
    const parser = new ActionPlanParserService();

    const plan = parser.parse({
      actions: [],
      safety: {
        riskLevel: "low",
        requiresConfirmation: false,
      },
      nextTick: {
        suggestedDelayMs: 0,
        priority: "high",
      },
    });

    expect(plan.actions).toEqual([
      {
        type: "noop",
        actionId: "act_empty_actions_noop",
        reason: "Model returned an empty actions array; normalized to explicit noop.",
      },
    ]);
    expect(plan.nextTick.suggestedDelayMs).toBe(500);
  });

  it("rejects malformed VTS action payloads with mixed catalog and raw hotkey targets", () => {
    const parser = new ActionPlanParserService();

    expect(() =>
      parser.parse({
        actions: [
          {
            type: "vts.trigger_hotkey",
            actionId: "act_bad",
            catalogId: "shock_sign",
            catalogVersion: "vts_catalog_demo",
            hotkeyId: "vts.catalog:shock_sign",
            confidence: 0.95,
            visualEvidence: "Open mouth and widened eyes are visible.",
            reason: "Surprise cue is clear.",
          },
        ],
        safety: {
          riskLevel: "low",
          requiresConfirmation: false,
        },
        nextTick: {
          suggestedDelayMs: 1000,
          priority: "normal",
        },
      }),
    ).toThrow();
  });

  it("accepts VTS cue-label actions without model-facing catalog identifiers", () => {
    const parser = new ActionPlanParserService();

    const plan = parser.parse({
      actions: [
        {
          type: "vts.trigger_hotkey",
          actionId: "act_cue",
          cueLabels: ["surprised", "shocked"],
          confidence: 0.95,
          visualEvidence: "Open mouth and widened eyes are visible.",
          reason: "Surprise cue is clear.",
        },
      ],
      safety: {
        riskLevel: "low",
        requiresConfirmation: false,
      },
      nextTick: {
        suggestedDelayMs: 1000,
        priority: "normal",
      },
    });

    expect(plan.actions[0]).toMatchObject({
      type: "vts.trigger_hotkey",
      cueLabels: ["surprised", "shocked"],
    });
  });

  it("rejects malformed dynamic cue-label IDs", () => {
    const parser = new ActionPlanParserService();

    expect(() =>
      parser.parse({
        actions: [
          {
            type: "vts.trigger_hotkey",
            actionId: "act_bad_cue",
            cueLabels: ["Big Smile!"],
            confidence: 0.95,
            visualEvidence: "A big smile is visible.",
            reason: "Malformed cue label.",
          },
        ],
        safety: {
          riskLevel: "low",
          requiresConfirmation: false,
        },
        nextTick: {
          suggestedDelayMs: 1000,
          priority: "normal",
        },
      }),
    ).toThrow();
  });

  it("rejects extra fields on VTS action payloads", () => {
    const parser = new ActionPlanParserService();

    expect(() =>
      parser.parse({
        actions: [
          {
            type: "vts.trigger_hotkey",
            actionId: "act_bad",
            catalogId: "heart_eyes",
            catalogVersion: "vts_catalog_demo",
            confidence: 0.95,
            visualEvidence: "A visible heart hand gesture is present.",
            sourceName: "not valid for VTS",
            reason: "Love cue is clear.",
          },
        ],
        safety: {
          riskLevel: "low",
          requiresConfirmation: false,
        },
        nextTick: {
          suggestedDelayMs: 1000,
          priority: "normal",
        },
      }),
    ).toThrow();
  });
});
