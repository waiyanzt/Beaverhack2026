import type { ActionExecutionResult, ReviewedAction } from "../../../shared/types/action-plan.types";
import type { CooldownService } from "./cooldown.service";

interface ActionExecutorObsService {
  setCurrentScene(sceneName: string): Promise<void>;
  setSourceVisibility(sceneName: string, sourceName: string, visible: boolean): Promise<void>;
}

interface ActionExecutorVtsService {
  triggerHotkey(hotkeyId: string): Promise<string>;
}

export class ActionExecutorService {
  public constructor(
    private readonly obsService: ActionExecutorObsService,
    private readonly vtsService: ActionExecutorVtsService,
    private readonly cooldownService: CooldownService,
  ) {}

  public async execute(reviewedActions: ReviewedAction[], dryRun = false): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];

    for (const reviewedAction of reviewedActions) {
      if (reviewedAction.status === "blocked") {
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "blocked",
          reason: reviewedAction.reason,
        });
        continue;
      }

      if (reviewedAction.status === "confirmation_required") {
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "confirmation_required",
          reason: reviewedAction.reason,
        });
        continue;
      }

      if (reviewedAction.action.type === "noop") {
        this.cooldownService.markAction(reviewedAction.action);
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "noop",
          reason: reviewedAction.action.reason,
        });
        continue;
      }

      if (dryRun) {
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "executed",
          reason: "Dry run: action approved for execution.",
        });
        continue;
      }

      try {
        await this.executeApprovedAction(reviewedAction);
        this.cooldownService.markAction(reviewedAction.action);
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "executed",
          reason: reviewedAction.action.reason,
        });
      } catch (error: unknown) {
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "failed",
          reason: reviewedAction.action.reason,
          errorMessage: error instanceof Error ? error.message : "Unknown execution error.",
        });
      }
    }

    return results;
  }

  private async executeApprovedAction(reviewedAction: ReviewedAction): Promise<void> {
    const { action } = reviewedAction;

    switch (action.type) {
      case "vts.trigger_hotkey":
        await this.vtsService.triggerHotkey(action.hotkeyId);
        return;
      case "obs.set_scene":
        await this.obsService.setCurrentScene(action.sceneName);
        return;
      case "obs.set_source_visibility":
        await this.obsService.setSourceVisibility(action.sceneName, action.sourceName, action.visible);
        return;
      case "overlay.message":
      case "log.event":
      case "noop":
        return;
      case "vts.set_parameter":
        throw new Error("VTube Studio parameter actions are not implemented yet.");
    }
  }
}
