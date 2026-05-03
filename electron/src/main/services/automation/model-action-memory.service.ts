import type { ActionPlan } from "../../../shared/schemas/action-plan.schema";
import type {
  ModelControlRecentModelAction,
  ModelControlRecentModelActionResult,
} from "../../../shared/types/observation.types";

export const DEFAULT_RECENT_MODEL_ACTION_LIMIT = 10;

export class ModelActionMemoryService {
  private readonly recentModelActions: ModelControlRecentModelAction[] = [];
  private nextSequence = 1;

  public constructor(
    private readonly limit: number = DEFAULT_RECENT_MODEL_ACTION_LIMIT,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  public getRecentModelActions(): ModelControlRecentModelAction[] {
    return this.recentModelActions.map((entry) => ({
      ...entry,
      actionPlan: structuredClone(entry.actionPlan),
      actionResults: entry.actionResults.map((result) => ({ ...result })),
    }));
  }

  public record(actionPlan: ActionPlan, actionResults: ModelControlRecentModelActionResult[]): void {
    this.recentModelActions.unshift({
      sequence: this.nextSequence,
      storedAt: this.now(),
      actionPlan: structuredClone(actionPlan),
      actionResults: actionResults.map((result) => ({ ...result })),
    });
    this.nextSequence += 1;

    if (this.recentModelActions.length > this.limit) {
      this.recentModelActions.length = this.limit;
    }
  }
}
