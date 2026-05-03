import type { ActionPlan, LocalAction } from "../schemas/action-plan.schema";
import type { ModelControlContext } from "./observation.types";

export type ActionReviewStatus =
  | "approved"
  | "blocked"
  | "confirmation_required";

export interface ReviewedAction {
  action: LocalAction;
  status: ActionReviewStatus;
  reason: string;
}

export type ActionExecutionStatus =
  | "executed"
  | "blocked"
  | "failed"
  | "confirmation_required"
  | "noop";

export interface ActionExecutionResult {
  actionId: string;
  type: LocalAction["type"];
  status: ActionExecutionStatus;
  reason: string;
  errorMessage?: string;
}

export interface AutomationAnalyzeNowRequest {
  transcript?: string;
  dryRun?: boolean;
}

export type AutomationAnalyzeNowResult =
  | {
      ok: true;
      modelContext: ModelControlContext;
      plan: ActionPlan;
      reviewedActions: ReviewedAction[];
      actionResults: ActionExecutionResult[];
    }
  | {
      ok: false;
      message: string;
    };
