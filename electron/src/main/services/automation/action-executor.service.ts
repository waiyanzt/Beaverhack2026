import type { ActionExecutionResult, ReviewedAction } from "../../../shared/types/action-plan.types";
import type { CooldownService } from "./cooldown.service";

interface ActionExecutorObsService {
  setCurrentScene(sceneName: string): Promise<void>;
  setSourceVisibility(sceneName: string, sourceName: string, visible: boolean): Promise<void>;
}

interface ActionExecutorVtsCatalogEntry {
  catalogId: string;
  hotkeyId: string;
  hasAutoDeactivate: boolean;
  manualDeactivateAfterMs: number;
}

interface ActionExecutorVtsService {
  triggerHotkey(hotkeyId: string): Promise<string>;
  resolveCatalogEntry(catalogId: string): ActionExecutorVtsCatalogEntry | null;
}

interface ActionExecutorDependencies {
  setTimeout?: typeof global.setTimeout;
  clearTimeout?: typeof global.clearTimeout;
}

export class ActionExecutorService {
  private readonly setTimeoutFn: typeof global.setTimeout;
  private readonly clearTimeoutFn: typeof global.clearTimeout;
  private readonly pendingDeactivateTimers = new Map<string, ReturnType<typeof setTimeout>>();

  public constructor(
    private readonly obsService: ActionExecutorObsService,
    private readonly vtsService: ActionExecutorVtsService,
    private readonly cooldownService: CooldownService,
    dependencies: ActionExecutorDependencies = {},
  ) {
    this.setTimeoutFn = dependencies.setTimeout ?? global.setTimeout;
    this.clearTimeoutFn = dependencies.clearTimeout ?? global.clearTimeout;
  }

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
          reason: `Dry run: ${this.getActionResultReason(reviewedAction)}`,
        });
        continue;
      }

      try {
        await this.executeApprovedAction(reviewedAction);
        this.cooldownService.markAction(this.buildRecordedAction(reviewedAction.action));
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "executed",
          reason: this.getActionResultReason(reviewedAction),
        });
      } catch (error: unknown) {
        results.push({
          actionId: reviewedAction.action.actionId,
          type: reviewedAction.action.type,
          status: "failed",
          reason: this.getActionResultReason(reviewedAction),
          errorMessage: error instanceof Error ? error.message : "Unknown execution error.",
        });
      }
    }

    return results;
  }

  private async executeApprovedAction(reviewedAction: ReviewedAction): Promise<void> {
    const { action } = reviewedAction;

    switch (action.type) {
      case "vts.trigger_hotkey": {
        const catalogEntry = action.catalogId ? this.vtsService.resolveCatalogEntry(action.catalogId) : null;
        const hotkeyId = catalogEntry?.hotkeyId ?? this.resolveVtsHotkeyId(action);
        await this.vtsService.triggerHotkey(hotkeyId);
        this.scheduleManualDeactivate(catalogEntry);
        return;
      }
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

  private getActionResultReason(reviewedAction: ReviewedAction): string {
    const { action } = reviewedAction;

    if ("reason" in action && typeof action.reason === "string" && action.reason.trim().length > 0) {
      return action.reason;
    }

    if (action.type === "log.event" && action.message.trim().length > 0) {
      return action.message;
    }

    return reviewedAction.reason || "Action execution completed.";
  }

  private resolveVtsHotkeyId(action: Extract<ReviewedAction["action"], { type: "vts.trigger_hotkey" }>): string {
    if (action.catalogId) {
      const catalogEntry = this.vtsService.resolveCatalogEntry(action.catalogId);

      if (!catalogEntry) {
        throw new Error(`VTS catalog item "${action.catalogId}" is no longer available.`);
      }

      return catalogEntry.hotkeyId;
    }

    if (action.hotkeyId) {
      return action.hotkeyId;
    }

    throw new Error("VTS hotkey action is missing both catalogId and hotkeyId.");
  }

  private buildRecordedAction(action: ReviewedAction["action"]): ReviewedAction["action"] {
    if (action.type !== "vts.trigger_hotkey" || !action.catalogId) {
      return action;
    }

    const catalogEntry = this.vtsService.resolveCatalogEntry(action.catalogId);
    if (!catalogEntry || catalogEntry.hasAutoDeactivate) {
      return action;
    }

    return {
      ...action,
      cooldownMs: Math.max(action.cooldownMs ?? 0, catalogEntry.manualDeactivateAfterMs),
    };
  }

  private scheduleManualDeactivate(catalogEntry: ActionExecutorVtsCatalogEntry | null): void {
    if (!catalogEntry) {
      return;
    }

    const existingTimer = this.pendingDeactivateTimers.get(catalogEntry.catalogId);
    if (existingTimer) {
      this.clearTimeoutFn(existingTimer);
      this.pendingDeactivateTimers.delete(catalogEntry.catalogId);
    }

    if (catalogEntry.hasAutoDeactivate) {
      return;
    }

    const timer = this.setTimeoutFn(() => {
      void this.runScheduledDeactivate(catalogEntry.catalogId, catalogEntry.hotkeyId);
    }, catalogEntry.manualDeactivateAfterMs);

    this.pendingDeactivateTimers.set(catalogEntry.catalogId, timer);
  }

  private async runScheduledDeactivate(catalogId: string, fallbackHotkeyId: string): Promise<void> {
    this.pendingDeactivateTimers.delete(catalogId);

    const catalogEntry = this.vtsService.resolveCatalogEntry(catalogId);
    if (catalogEntry?.hasAutoDeactivate) {
      return;
    }

    const hotkeyId = catalogEntry?.hotkeyId ?? fallbackHotkeyId;

    try {
      await this.vtsService.triggerHotkey(hotkeyId);
    } catch {
      // A best-effort cleanup trigger should not break the pipeline if the model changed or VTS disconnected.
    }
  }
}
