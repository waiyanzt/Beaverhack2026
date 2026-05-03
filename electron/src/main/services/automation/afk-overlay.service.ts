import type { LocalAction } from "../../../shared/schemas/action-plan.schema";
import type { ReviewedAction } from "../../../shared/types/action-plan.types";
import type { AfkOverlayConfig } from "../../../shared/types/config.types";
import type { ModelControlContext } from "../../../shared/types/observation.types";
import { createId } from "../../utils/ids";
import type { ActionPlanParserService } from "./action-plan-parser.service";

const DEFAULT_AFK_OVERLAY_CONFIG: AfkOverlayConfig = {
  enabled: false,
  sceneName: null,
  sourceName: null,
  vacantEnterDelayMs: 5_000,
};

export class AfkOverlayService {
  private vacantFirstSeenMs: number | null = null;
  private overlayShownByAutomation = false;

  public constructor(
    private readonly getConfig: () => AfkOverlayConfig = () => DEFAULT_AFK_OVERLAY_CONFIG,
    private readonly now: () => number = () => Date.now(),
  ) {}

  public reviewTransitions(
    rawPlan: ReturnType<ActionPlanParserService["parse"]>,
    modelContext: ModelControlContext,
    dryRun: boolean,
  ): ReviewedAction[] {
    const config = this.getConfig();
    const hasAfkSignal = this.hasAfkSignal(rawPlan);
    const target = this.getTarget(config, modelContext);

    if (!target) {
      this.vacantFirstSeenMs = null;
      this.overlayShownByAutomation = false;

      return hasAfkSignal
        ? [this.createDiagnosticAction(this.getTargetUnavailableReason(config, modelContext))]
        : [];
    }

    if (hasAfkSignal) {
      return this.reviewEnterAfkTransition(config, target, dryRun);
    }

    return this.reviewExitAfkTransition(target, dryRun);
  }

  private reviewEnterAfkTransition(
    config: AfkOverlayConfig,
    target: {
      sceneName: string;
      sourceName: string;
      visible: boolean;
    },
    dryRun: boolean,
  ): ReviewedAction[] {
    if (target.visible) {
      this.overlayShownByAutomation = true;
      return [];
    }

    const nowMs = this.now();
    if (this.vacantFirstSeenMs === null) {
      this.vacantFirstSeenMs = nowMs;
    }

    if (nowMs - this.vacantFirstSeenMs < config.vacantEnterDelayMs) {
      return [];
    }

    if (!dryRun) {
      this.overlayShownByAutomation = true;
    }

    return [
      {
        action: {
          type: "obs.set_source_visibility",
          actionId: createId("afk_overlay"),
          sceneName: target.sceneName,
          sourceName: target.sourceName,
          visible: true,
          reason: "AFK detected: no person is visible on camera.",
        },
        status: "approved",
        reason: `AFK overlay transition: showing selected OBS source after ${config.vacantEnterDelayMs}ms debounce.`,
      },
    ];
  }

  private reviewExitAfkTransition(
    target: {
      sceneName: string;
      sourceName: string;
      visible: boolean;
    },
    dryRun: boolean,
  ): ReviewedAction[] {
    this.vacantFirstSeenMs = null;

    if (!this.overlayShownByAutomation) {
      return [];
    }

    if (!target.visible) {
      this.overlayShownByAutomation = false;
      return [];
    }

    if (!dryRun) {
      this.overlayShownByAutomation = false;
    }

    return [
      {
        action: {
          type: "obs.set_source_visibility",
          actionId: createId("afk_overlay"),
          sceneName: target.sceneName,
          sourceName: target.sourceName,
          visible: false,
          reason: "AFK cleared: person is visible on camera.",
        },
        status: "approved",
        reason: "AFK overlay transition: hiding selected OBS source.",
      },
    ];
  }

  private getTarget(
    config: AfkOverlayConfig,
    modelContext: ModelControlContext,
  ): { sceneName: string; sourceName: string; visible: boolean } | null {
    if (!config.enabled || !config.sceneName || !config.sourceName || !modelContext.services.obs.connected) {
      return null;
    }

    const scene = modelContext.services.obs.scenes.find((candidate) => candidate.name === config.sceneName);
    const source = scene?.sources.find((candidate) => candidate.name === config.sourceName);

    if (!scene || !source) {
      return null;
    }

    return {
      sceneName: scene.name,
      sourceName: source.name,
      visible: source.visible,
    };
  }

  private getTargetUnavailableReason(config: AfkOverlayConfig, modelContext: ModelControlContext): string {
    if (!config.enabled) {
      return "AFK overlay signal received, but AFK overlay automation is disabled in settings.";
    }

    if (!config.sceneName || !config.sourceName) {
      return "AFK overlay signal received, but no OBS scene/source is selected for the AFK overlay.";
    }

    if (!modelContext.services.obs.connected) {
      return "AFK overlay signal received, but OBS is not connected.";
    }

    const scene = modelContext.services.obs.scenes.find((candidate) => candidate.name === config.sceneName);
    if (!scene) {
      return `AFK overlay signal received, but OBS scene "${config.sceneName}" is not available.`;
    }

    const source = scene.sources.find((candidate) => candidate.name === config.sourceName);
    if (!source) {
      return `AFK overlay signal received, but source "${config.sourceName}" is not available in scene "${config.sceneName}".`;
    }

    return "AFK overlay signal received, but the selected OBS overlay target is not available.";
  }

  private createDiagnosticAction(message: string): ReviewedAction {
    return {
      action: {
        type: "log.event",
        actionId: createId("afk_overlay_diagnostic"),
        level: "warn",
        message,
        metadata: {
          feature: "afk_overlay",
        },
      },
      status: "approved",
      reason: message,
    };
  }

  private hasAfkSignal(plan: ReturnType<ActionPlanParserService["parse"]>): boolean {
    return (
      plan.actions.some((action) => this.isVacantCueAction(action)) ||
      this.hasExplicitNoPersonObservation([
        plan.response?.text,
        ...plan.actions.map((action) => action.reason),
        ...plan.actions.map((action) => (action.type === "vts.trigger_hotkey" ? action.visualEvidence : undefined)),
      ])
    );
  }

  private isVacantCueAction(action: LocalAction): boolean {
    return (
      action.type === "vts.trigger_hotkey" &&
      Array.isArray(action.cueLabels) &&
      action.cueLabels.includes("vacant")
    );
  }

  private hasExplicitNoPersonObservation(values: Array<string | undefined>): boolean {
    const combined = values
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    const afkEvidencePatterns = [
      "no person visible",
      "no person is visible",
      "no person detected",
      "no people detected",
      "no visible person",
      "no one visible",
      "empty camera",
      "camera is empty",
      "camera covered",
      "camera is covered",
      "covered camera",
      "black frame",
      "camera is black",
      "pointed away",
    ];

    return afkEvidencePatterns.some((pattern) => combined.includes(pattern));
  }
}
