import { actionPlanSchema, type ActionPlan } from "../../../shared/schemas/action-plan.schema";
import { createId } from "../../utils/ids";

const partialActionPlanSchema = actionPlanSchema.partial({
  schemaVersion: true,
  tickId: true,
  createdAt: true,
});

export class ActionPlanParserService {
  public parse(input: unknown): ActionPlan {
    const partialPlan = partialActionPlanSchema.parse(input);

    return actionPlanSchema.parse({
      ...partialPlan,
      schemaVersion: partialPlan.schemaVersion ?? "2026-05-02",
      tickId: partialPlan.tickId ?? createId("tick"),
      createdAt: partialPlan.createdAt ?? new Date().toISOString(),
    });
  }
}
