import { modelControlContextSchema } from "../../../shared/schemas/observation.schema";
import type { ObsStatus } from "../../../shared/types/obs.types";
import type {
  AutomationAutonomyLevel,
  ModelControlContext,
  ModelControlRecentModelAction,
  SupportedActionType,
} from "../../../shared/types/observation.types";
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
              .filter((entry) => entry.autoMode === "safe_auto")
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
          scenes: obsStatus.connected ? obsStatus.scenes : [],
        },
        policy: {
          allowedActions,
        },
      },
      context: {
        autonomyLevel: request.autonomyLevel ?? "auto_safe",
        recentActions: this.cooldownService.getRecentActions(),
        recentModelActions: request.recentModelActions ?? [],
        cooldowns: this.cooldownService.getRemainingCooldowns(),
      },
    });

    return context;
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
}
