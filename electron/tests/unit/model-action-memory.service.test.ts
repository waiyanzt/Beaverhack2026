import { describe, expect, it } from "vitest";
import { ModelActionMemoryService } from "../../src/main/services/automation/model-action-memory.service";
import type { ActionPlan } from "../../src/shared/schemas/action-plan.schema";

function createNoopPlan(actionId: string): ActionPlan {
  return {
    schemaVersion: "2026-05-02",
    tickId: `tick_${actionId}`,
    createdAt: "2026-05-02T10:00:00.000Z",
    actions: [
      {
        type: "noop",
        actionId,
        reason: `Reason for ${actionId}.`,
      },
    ],
    safety: {
      riskLevel: "low",
      requiresConfirmation: false,
      reason: `Safety reason for ${actionId}.`,
    },
    nextTick: {
      suggestedDelayMs: 5000,
      priority: "normal",
    },
  };
}

describe("ModelActionMemoryService", () => {
  it("keeps the most recent model action plans in a bounded window", () => {
    const service = new ModelActionMemoryService(2, () => "2026-05-02T10:00:00.000Z");

    service.record(createNoopPlan("act_1"), [
      {
        actionId: "act_1",
        type: "noop",
        status: "noop",
        reason: "No action required.",
      },
    ]);
    service.record(createNoopPlan("act_2"), []);
    service.record(createNoopPlan("act_3"), []);

    const recentModelActions = service.getRecentModelActions();

    expect(recentModelActions).toHaveLength(2);
    expect(recentModelActions.map((entry) => entry.actionPlan.actions[0]?.actionId)).toEqual(["act_3", "act_2"]);
    expect(recentModelActions.map((entry) => entry.sequence)).toEqual([3, 2]);
  });

  it("returns copies so callers cannot mutate stored memory", () => {
    const service = new ModelActionMemoryService(10, () => "2026-05-02T10:00:00.000Z");
    service.record(createNoopPlan("act_original"), []);

    const [entry] = service.getRecentModelActions();
    entry.actionPlan.actions[0].reason = "Mutated by caller.";

    expect(service.getRecentModelActions()[0]?.actionPlan.actions[0]?.reason).toBe("Reason for act_original.");
  });

  it("normalizes malformed stored result reasons before returning memory", () => {
    const service = new ModelActionMemoryService(10, () => "2026-05-02T10:00:00.000Z");

    service.record(createNoopPlan("act_bad_result"), [
      {
        actionId: "act_bad_result",
        type: "log.event",
        status: "executed",
        reason: undefined,
      } as never,
    ]);

    expect(service.getRecentModelActions()[0]?.actionResults[0]?.reason).toBe("No execution reason was recorded.");
  });
});
