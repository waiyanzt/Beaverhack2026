import type { ActionPlan, LocalAction } from "../schemas/action-plan.schema";
import type { ModelProviderId } from "../model.types";
import type { ModelControlContext } from "./observation.types";

export type AutomationDecisionRole = "primary_emote" | "secondary_director";
export type VtsCandidateMode = "safe_auto" | "inferable";

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
  useLatestCapture?: boolean;
  captureInputMode?: "latest_frame" | "clip";
  captureWindowMs?: number;
  includeSeparateAudio?: boolean;
  allowObsActions?: boolean;
  modelProviderId?: ModelProviderId;
  decisionRole?: AutomationDecisionRole;
  vtsCandidateMode?: VtsCandidateMode;
}

export interface AutomationRequestDebug {
  providerId: string;
  decisionRole: AutomationDecisionRole;
  statusCode: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  pipelineStartedAt: string;
  modelRequestStartedAt: string;
  modelResponseReceivedAt: string;
  observationLatencyMs: number;
  captureInputLatencyMs: number;
  promptBuildLatencyMs: number;
  modelRequestLatencyMs: number;
  parseValidateExecuteLatencyMs: number;
  pipelineLatencyMs: number;
  promptTextBytes: number;
  mediaDataUrlBytes: number;
  requestContentBytes: number;
  sourceWindowKey: string | null;
  sourceClipCount: number;
  modelMediaSha256: string | null;
  modelMediaDataUrl: string | null;
  mediaStartedAt: string | null;
  mediaEndedAt: string | null;
}

export type AutomationAnalyzeNowResult =
  | {
      ok: true;
      modelContext: ModelControlContext;
      plan: ActionPlan;
      reviewedActions: ReviewedAction[];
      actionResults: ActionExecutionResult[];
      requestDebug: AutomationRequestDebug;
    }
  | {
      ok: false;
      message: string;
    };
