import type { LocalAction } from "../../../shared/schemas/action-plan.schema";
import type { ModelControlRecentAction, SupportedActionType } from "../../../shared/types/observation.types";

interface CooldownEntry {
  expiresAtMs: number;
}

export class CooldownService {
  private readonly cooldowns = new Map<string, CooldownEntry>();
  private readonly recentActions: ModelControlRecentAction[] = [];

  public constructor(
    private readonly clock: () => number = () => Date.now(),
    private readonly recentActionLimit: number = 20,
  ) {}

  public getRemainingCooldowns(): Record<string, number> {
    this.pruneExpiredCooldowns();

    const now = this.clock();
    return Object.fromEntries(
      [...this.cooldowns.entries()].map(([key, entry]) => [key, Math.max(entry.expiresAtMs - now, 0)]),
    );
  }

  public getRecentActions(): ModelControlRecentAction[] {
    return [...this.recentActions];
  }

  public isCoolingDown(key: string): boolean {
    this.pruneExpiredCooldowns();
    const entry = this.cooldowns.get(key);
    return entry !== undefined && entry.expiresAtMs > this.clock();
  }

  public markAction(action: LocalAction, timestamp = new Date(this.clock()).toISOString()): void {
    const cooldownKey = this.getActionTargetKey(action);

    if ("cooldownMs" in action && typeof action.cooldownMs === "number" && action.cooldownMs > 0) {
      this.cooldowns.set(cooldownKey, {
        expiresAtMs: this.clock() + action.cooldownMs,
      });
    }

    this.recentActions.unshift({
      actionId: action.actionId,
      type: action.type as SupportedActionType,
      target: cooldownKey,
      label: this.getActionLabel(action),
      timestamp,
    });

    if (this.recentActions.length > this.recentActionLimit) {
      this.recentActions.length = this.recentActionLimit;
    }
  }

  public getActionTargetKey(action: LocalAction): string {
    switch (action.type) {
      case "vts.trigger_hotkey":
        return `vts.hotkey:${action.hotkeyId}`;
      case "vts.set_parameter":
        return `vts.parameter:${action.parameterId}`;
      case "obs.set_scene":
        return `obs.scene:${action.sceneName}`;
      case "obs.set_source_visibility":
        return `obs.source:${action.sceneName}:${action.sourceName}:${action.visible ? "show" : "hide"}`;
      case "overlay.message":
        return `overlay.message:${action.message}`;
      case "log.event":
        return `log.event:${action.level}`;
      case "noop":
        return "noop";
    }
  }

  private pruneExpiredCooldowns(): void {
    const now = this.clock();
    for (const [key, entry] of this.cooldowns.entries()) {
      if (entry.expiresAtMs <= now) {
        this.cooldowns.delete(key);
      }
    }
  }

  private getActionLabel(action: LocalAction): string {
    switch (action.type) {
      case "vts.trigger_hotkey":
        return `VTS hotkey: ${action.hotkeyId}`;
      case "vts.set_parameter":
        return `VTS parameter: ${action.parameterId} -> ${action.value}`;
      case "obs.set_scene":
        return `OBS scene: ${action.sceneName}`;
      case "obs.set_source_visibility":
        return `OBS source: ${action.sceneName} / ${action.sourceName} -> ${action.visible ? "show" : "hide"}`;
      case "overlay.message":
        return `Overlay message: ${action.message}`;
      case "log.event":
        return `Log event: ${action.level}`;
      case "noop":
        return "No action";
    }
  }
}
