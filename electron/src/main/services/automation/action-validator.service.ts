import type { LocalAction } from "../../../shared/schemas/action-plan.schema";
import type { ReviewedAction } from "../../../shared/types/action-plan.types";
import type { ModelControlContext } from "../../../shared/types/observation.types";
import type { CooldownService } from "./cooldown.service";

const DEFAULT_VTS_HOTKEY_REPEAT_WINDOW_MS = 6_000;

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
      if (!modelContext.services.vts.connected || !modelContext.services.vts.authenticated) {
        return {
          action,
          status: "blocked",
          reason: "VTube Studio is not connected and authenticated.",
        };
      }

      const knownHotkey = modelContext.services.vts.availableHotkeys.find(
        (hotkey) => hotkey.id === action.hotkeyId,
      );
      if (!knownHotkey) {
        return {
          action,
          status: "blocked",
          reason: `Hotkey "${action.hotkeyId}" is not available in the current VTube Studio model.`,
        };
      }

      if (this.wasRecentlyTriggered(action, modelContext)) {
        return {
          action,
          status: "blocked",
          reason: `Hotkey "${action.hotkeyId}" was already triggered recently and is being suppressed.`,
        };
      }
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
}
