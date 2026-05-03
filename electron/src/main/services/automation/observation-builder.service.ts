import { modelControlContextSchema } from "../../../shared/schemas/observation.schema";
import type { ObsStatus } from "../../../shared/types/obs.types";
import type {
  AutomationAutonomyLevel,
  ModelControlContext,
  ModelControlRecentModelAction,
  ModelControlRecentActionSummary,
  SupportedActionType,
} from "../../../shared/types/observation.types";
import type { VtsCandidateMode } from "../../../shared/types/action-plan.types";
import type { LocalAction } from "../../../shared/schemas/action-plan.schema";
import type { VtsHotkey, VtsStatus } from "../../../shared/types/vts.types";
import type { CooldownService } from "./cooldown.service";

interface ObservationBuilderObsService {
  getStatus(): Promise<ObsStatus>;
}

interface ObservationBuilderVtsService {
  getStatus(): VtsStatus;
  getCachedHotkeys(): VtsHotkey[];
  refreshCatalogIfStale?(maxAgeMs?: number): Promise<void>;
}

export interface BuildModelContextRequest {
  tickId: string;
  transcript?: string;
  autonomyLevel?: AutomationAutonomyLevel;
  recentModelActions?: ModelControlRecentModelAction[];
  allowObsActions?: boolean;
  vtsCandidateMode?: VtsCandidateMode;
}

export class ObservationBuilderService {
  public constructor(
    private readonly obsService: ObservationBuilderObsService,
    private readonly vtsService: ObservationBuilderVtsService,
    private readonly cooldownService: CooldownService,
  ) {}

  public async buildModelContext(
    request: BuildModelContextRequest,
  ): Promise<ModelControlContext> {
    const [obsStatus, vtsStatus] = await Promise.all([
      this.obsService.getStatus(),
      (async () => {
        await this.vtsService.refreshCatalogIfStale?.();
        return this.vtsService.getStatus();
      })(),
    ]);

    const candidateMode = request.vtsCandidateMode ?? "safe_auto";
    const allowedActions = this.getAllowedActions(obsStatus, vtsStatus, request.allowObsActions ?? true);
    const context = modelControlContextSchema.parse({
      tickId: request.tickId,
      timestamp: new Date().toISOString(),
      transcript: request.transcript ?? null,
      services: {
        vts: {
          connected: vtsStatus.connected,
          authenticated: vtsStatus.authenticated,
          currentModelName: vtsStatus.modelName,
          availableHotkeys: [],
          automationCatalog: {
            version: vtsStatus.catalog.version,
            readinessState: vtsStatus.readinessState,
            readyForAutomation: vtsStatus.readyForAutomation,
            safeAutoCount: vtsStatus.catalog.safeAutoCount,
            suggestOnlyCount: vtsStatus.catalog.suggestOnlyCount,
            manualOnlyCount: vtsStatus.catalog.manualOnlyCount,
            candidates: vtsStatus.catalog.entries
              .filter((entry) => this.isVisibleVtsCandidate(entry.autoMode, candidateMode))
              .map((entry) => ({
                catalogId: entry.catalogId,
                label: entry.promptName,
                description: entry.promptDescription,
                cueLabels: entry.cueLabels,
                emoteKind: entry.emoteKind,
                autoMode: entry.autoMode,
              })),
          },
        },
        obs: {
          connected: obsStatus.connected,
          currentScene: obsStatus.connected ? obsStatus.currentScene : null,
          streamStatus: obsStatus.connected ? obsStatus.streamStatus : "inactive",
          recordingStatus: obsStatus.connected ? obsStatus.recordingStatus : "inactive",
          scenes: obsStatus.connected && (request.allowObsActions ?? true)
            ? obsStatus.scenes
            : [],
        },
        policy: {
          allowedActions,
        },
      },
      context: {
        autonomyLevel: request.autonomyLevel ?? "auto_safe",
        recentActions: this.cooldownService.getRecentActions(),
        recentModelActions: request.recentModelActions ?? [],
        recentActionSummary: this.buildRecentActionSummary(request.recentModelActions ?? []),
        cooldowns: this.cooldownService.getRemainingCooldowns(),
        cooldownSummary: this.buildCooldownSummary(this.cooldownService.getRemainingCooldowns()),
      },
    });

    return context;
  }

  private isVisibleVtsCandidate(autoMode: "safe_auto" | "suggest_only" | "manual_only", mode: VtsCandidateMode): boolean {
    if (mode === "inferable") {
      return autoMode === "safe_auto" || autoMode === "suggest_only";
    }

    return autoMode === "safe_auto";
  }

  private getAllowedActions(
    obsStatus: ObsStatus,
    vtsStatus: VtsStatus,
    allowObsActions: boolean,
  ): SupportedActionType[] {
    const allowedActions: SupportedActionType[] = ["overlay.message", "log.event", "noop"];

    if (vtsStatus.readyForAutomation && vtsStatus.catalog.safeAutoCount > 0) {
      allowedActions.unshift("vts.trigger_hotkey");
    }

    if (allowObsActions && obsStatus.connected) {
      allowedActions.unshift("obs.set_source_visibility", "obs.set_scene");
    }

    return [...new Set(allowedActions)];
  }

  private buildRecentActionSummary(actions: ModelControlRecentModelAction[]): ModelControlRecentActionSummary[] {
    const nowMs = Date.now();

    return actions
      .flatMap((entry) => {
        const ageMs = Math.max(nowMs - Date.parse(entry.storedAt), 0);

        return entry.actionPlan.actions
          .filter((action): action is Extract<LocalAction, { type: "vts.trigger_hotkey" }> => {
            return action.type === "vts.trigger_hotkey" && typeof action.catalogId === "string";
          })
          .map((action) => {
            const result = entry.actionResults.find((candidate) => candidate.actionId === action.actionId);
            const reason = result?.reason.toLowerCase() ?? "";
            const blockedReasonCode = result?.status === "blocked"
              ? reason.includes("cooldown") || reason.includes("suppressed")
                ? "cooldown"
                : "policy"
              : undefined;

            return {
              catalogId: action.catalogId,
              actionType: action.type,
              ageMs,
              status: result?.status ?? "not_executed",
              blockedReasonCode,
            } satisfies ModelControlRecentActionSummary;
          });
      })
      .slice(0, 4);
  }

  private buildCooldownSummary(cooldowns: Record<string, number>): Record<string, { remainingMs: number }> {
    return Object.fromEntries(
      Object.entries(cooldowns)
        .filter(([key]) => key.startsWith("vts.catalog:"))
        .map(([key, remainingMs]) => [key.replace("vts.catalog:", ""), { remainingMs }]),
    );
  }
}
