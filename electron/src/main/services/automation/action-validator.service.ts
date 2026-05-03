import type { LocalAction } from "../../../shared/schemas/action-plan.schema";
import type { ReviewedAction } from "../../../shared/types/action-plan.types";
import type { ModelControlContext } from "../../../shared/types/observation.types";
import type { CooldownService } from "./cooldown.service";

const DEFAULT_VTS_HOTKEY_REPEAT_WINDOW_MS = 6_000;
const MIN_AUTO_VTS_CONFIDENCE = 0.88;
const UNCERTAIN_ACTION_TERMS = [
  "maybe",
  "might",
  "possibly",
  "probably",
  "unclear",
  "ambiguous",
  "guess",
  "seems like",
  "looks like it might",
];

export class ActionValidatorService {
  public constructor(private readonly cooldownService: CooldownService) {}

  public reviewActions(
    actions: LocalAction[],
    modelContext: ModelControlContext,
    planRequiresConfirmation: boolean,
  ): ReviewedAction[] {
    return actions.map((action) => this.reviewAction(action, modelContext, planRequiresConfirmation));
  }

  private reviewAction(
    action: LocalAction,
    modelContext: ModelControlContext,
    planRequiresConfirmation: boolean,
  ): ReviewedAction {
    if (!modelContext.services.policy.allowedActions.includes(action.type)) {
      return {
        action,
        status: "blocked",
        reason: `Action type "${action.type}" is not allowed by current policy.`,
      };
    }

    const cooldownKey = this.cooldownService.getActionTargetKey(action);
    if (this.cooldownService.isCoolingDown(cooldownKey)) {
      return {
        action,
        status: "blocked",
        reason: `Action target "${cooldownKey}" is currently cooling down.`,
      };
    }

    if (planRequiresConfirmation || this.requiresConfirmation(action.type)) {
      return {
        action,
        status: "confirmation_required",
        reason: "Action requires confirmation before execution.",
      };
    }

    if (action.type === "vts.trigger_hotkey") {
      const catalogState = modelContext.services.vts.automationCatalog;

      if (!catalogState.readyForAutomation) {
        return {
          action,
          status: "blocked",
          reason: `VTube Studio is not ready for automation (${catalogState.readinessState}).`,
        };
      }

      if (!action.catalogId) {
        return {
          action,
          status: "blocked",
          reason: "VTS automation actions must use a catalogId from the current automation catalog.",
        };
      }

      if (catalogState.version && action.catalogVersion && action.catalogVersion !== catalogState.version) {
        return {
          action,
          status: "blocked",
          reason: `VTS catalog version "${action.catalogVersion}" is stale. Current version is "${catalogState.version}".`,
        };
      }

      const catalogItem = catalogState.candidates.find((candidate) => candidate.catalogId === action.catalogId);
      if (!catalogItem) {
        return {
          action,
          status: "blocked",
          reason: `Catalog item "${action.catalogId}" is not available in the current safe automation candidates.`,
        };
      }

      if (catalogItem.autoMode !== "safe_auto") {
        return {
          action,
          status: "blocked",
          reason: `Catalog item "${action.catalogId}" is not approved for automatic execution.`,
        };
      }

      if (typeof action.confidence !== "number" || action.confidence < MIN_AUTO_VTS_CONFIDENCE) {
        return {
          action,
          status: "blocked",
          reason: `VTS automation requires confidence >= ${MIN_AUTO_VTS_CONFIDENCE}.`,
        };
      }

      if (!action.visualEvidence || action.visualEvidence.trim().length < 8) {
        return {
          action,
          status: "blocked",
          reason: "VTS automation requires concrete visual evidence from the current media.",
        };
      }

      if (this.containsUncertainty(action.reason) || this.containsUncertainty(action.visualEvidence)) {
        return {
          action,
          status: "blocked",
          reason: "VTS automation evidence is uncertain; suppressing automatic emote trigger.",
        };
      }

      if (this.wasRecentlyTriggered(action, modelContext)) {
        return {
          action,
          status: "blocked",
          reason: `Catalog item "${action.catalogId}" was already triggered recently and is being suppressed.`,
        };
      }
    }

    if (action.type === "noop" && this.noopReasonSuggestsAvailableAction(action.reason, modelContext)) {
      return {
        action,
        status: "blocked",
        reason: "Noop reason appears to support an available current automation action.",
      };
    }

    if (action.type === "obs.set_scene" || action.type === "obs.set_source_visibility") {
      if (!modelContext.services.obs.connected) {
        return {
          action,
          status: "blocked",
          reason: "OBS is not connected.",
        };
      }

      const scene = modelContext.services.obs.scenes.find((candidate) => candidate.name === action.sceneName);
      if (!scene) {
        return {
          action,
          status: "blocked",
          reason: `Scene "${action.sceneName}" is not available in OBS.`,
        };
      }

      if (action.type === "obs.set_source_visibility") {
        const source = scene.sources.find((candidate) => candidate.name === action.sourceName);
        if (!source) {
          return {
            action,
            status: "blocked",
            reason: `Source "${action.sourceName}" is not available in scene "${action.sceneName}".`,
          };
        }
      }
    }

    return {
      action,
      status: "approved",
      reason: "Action passed validation.",
    };
  }

  private requiresConfirmation(actionType: LocalAction["type"]): boolean {
    return actionType === "obs.set_scene" || actionType === "obs.set_source_visibility" || actionType === "vts.set_parameter";
  }

  private wasRecentlyTriggered(action: Extract<LocalAction, { type: "vts.trigger_hotkey" }>, modelContext: ModelControlContext): boolean {
    const targetKey = this.cooldownService.getActionTargetKey(action);
    const latestMatchingAction = modelContext.context.recentActions.find(
      (recentAction) => recentAction.target === targetKey,
    );

    if (!latestMatchingAction) {
      return false;
    }

    const latestActionMs = Date.parse(latestMatchingAction.timestamp);
    const contextTimestampMs = Date.parse(modelContext.timestamp);
    if (Number.isNaN(latestActionMs) || Number.isNaN(contextTimestampMs)) {
      return false;
    }

    const repeatWindowMs =
      typeof action.cooldownMs === "number" && action.cooldownMs > 0
        ? action.cooldownMs
        : DEFAULT_VTS_HOTKEY_REPEAT_WINDOW_MS;

    return contextTimestampMs - latestActionMs < repeatWindowMs;
  }

  private noopReasonSuggestsAvailableAction(reason: string, modelContext: ModelControlContext): boolean {
    const normalizedReason = reason.toLowerCase();
    const supportiveTerms = ["match", "matches", "matching", "indicates", "supports", "clearly", "visible"];
    const mentionsSupportiveTerm = supportiveTerms.some((term) => normalizedReason.includes(term));

    if (!mentionsSupportiveTerm) {
      return false;
    }

    const candidateTerms = modelContext.services.vts.automationCatalog.candidates.flatMap((candidate) => {
      const labelTerms = candidate.label.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
      return [
        candidate.catalogId.toLowerCase(),
        candidate.label.toLowerCase(),
        ...candidate.cueLabels.map((cueLabel) => cueLabel.toLowerCase()),
        ...labelTerms,
      ];
    });

    return [...new Set(candidateTerms)].some((term) => term.length > 2 && normalizedReason.includes(term));
  }

  private containsUncertainty(value: string): boolean {
    const normalized = value.toLowerCase();
    return UNCERTAIN_ACTION_TERMS.some((term) => normalized.includes(term));
  }
}
