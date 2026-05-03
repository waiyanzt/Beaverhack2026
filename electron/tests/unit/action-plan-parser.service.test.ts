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
});
