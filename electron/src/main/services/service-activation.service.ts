import type { VtsConnectionConfig } from "../../shared/types/config.types";
import type { ObsStatus } from "../../shared/types/obs.types";
import type { ServiceActivationStatus, ServiceActivationTargetStatus, ServiceActivationTrigger } from "../../shared/types/service-activation.types";
import type { VtsStatus } from "../../shared/types/vts.types";
import type { SettingsService } from "./settings/settings.service";

interface ServiceActivationObsService {
  connect(host?: string, port?: number): Promise<void>;
  getStatus(): Promise<ObsStatus>;
}

interface ServiceActivationVtsService {
  getStatus(): VtsStatus;
  connect(config: VtsConnectionConfig): Promise<VtsStatus>;
  authenticate(): Promise<VtsStatus>;
}

interface ServiceActivationDependencies {
  obsService: ServiceActivationObsService;
  vtsService: ServiceActivationVtsService;
  settingsService: Pick<SettingsService, "getSettings">;
  retryDelayMs?: number;
  clock?: () => number;
}

const createTargetStatus = (authenticated?: boolean): ServiceActivationTargetStatus => ({
  ready: false,
  connected: false,
  authenticated,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
});

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();

export class ServiceActivationService {
  private readonly obsService: ServiceActivationObsService;
  private readonly vtsService: ServiceActivationVtsService;
  private readonly settingsService: Pick<SettingsService, "getSettings">;
  private readonly retryDelayMs: number;
  private readonly clock: () => number;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private activationPromise: Promise<ServiceActivationStatus> | null = null;
  private status: ServiceActivationStatus = {
    inFlight: false,
    retryScheduled: false,
    lastTrigger: null,
    obs: createTargetStatus(),
    vts: createTargetStatus(false),
  };

  public constructor(dependencies: ServiceActivationDependencies) {
    this.obsService = dependencies.obsService;
    this.vtsService = dependencies.vtsService;
    this.settingsService = dependencies.settingsService;
    this.retryDelayMs = dependencies.retryDelayMs ?? 5_000;
    this.clock = dependencies.clock ?? (() => Date.now());
  }

  public getStatus(): ServiceActivationStatus {
    return {
      ...this.status,
      obs: { ...this.status.obs },
      vts: { ...this.status.vts },
    };
  }

  public activate(trigger: ServiceActivationTrigger, allowRetry = true): Promise<ServiceActivationStatus> {
    if (this.activationPromise) {
      return this.activationPromise;
    }

    this.clearRetryTimer();
    this.status = {
      ...this.status,
      inFlight: true,
      retryScheduled: false,
      lastTrigger: trigger,
    };

    this.activationPromise = this.runActivation(trigger, allowRetry).finally(() => {
      this.activationPromise = null;
    });

    return this.activationPromise;
  }

  private async runActivation(
    trigger: ServiceActivationTrigger,
    allowRetry: boolean,
  ): Promise<ServiceActivationStatus> {
    const attemptedAt = toIso(this.clock());
    const [obsStatus, vtsStatus] = await Promise.all([
      this.activateObs(attemptedAt),
      this.activateVts(attemptedAt),
    ]);

    const shouldRetry = allowRetry && (!obsStatus.ready || !vtsStatus.connected);

    this.status = {
      ...this.status,
      inFlight: false,
      retryScheduled: shouldRetry,
      lastTrigger: trigger,
      obs: obsStatus,
      vts: vtsStatus,
    };

    if (shouldRetry) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.activate("auto_retry", true);
      }, this.retryDelayMs);
    }

    return this.getStatus();
  }

  private async activateObs(attemptedAt: string): Promise<ServiceActivationTargetStatus> {
    try {
      const currentStatus = await this.obsService.getStatus();
      const status = currentStatus.connected
        ? currentStatus
        : await (async () => {
            await this.obsService.connect();
            return this.obsService.getStatus();
          })();

      if (status.connected) {
        return {
          ready: true,
          connected: true,
          lastAttemptAt: attemptedAt,
          lastSuccessAt: attemptedAt,
          lastError: null,
        };
      }

      return {
        ...this.status.obs,
        ready: false,
        connected: false,
        lastAttemptAt: attemptedAt,
        lastError: "OBS did not report a connected state after activation.",
      };
    } catch (error: unknown) {
      return {
        ...this.status.obs,
        ready: false,
        connected: false,
        lastAttemptAt: attemptedAt,
        lastError: error instanceof Error ? error.message : "Unable to connect to OBS.",
      };
    }
  }

  private async activateVts(attemptedAt: string): Promise<ServiceActivationTargetStatus> {
    const currentStatus = this.vtsService.getStatus();

    if (currentStatus.authenticated) {
      return {
        ready: true,
        connected: true,
        authenticated: true,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: attemptedAt,
        lastError: null,
      };
    }

    try {
      const connectedStatus = currentStatus.connected
        ? currentStatus
        : await this.vtsService.connect(this.settingsService.getSettings().vts);
      const authenticatedStatus = connectedStatus.authenticated
        ? connectedStatus
        : await this.vtsService.authenticate();

      return {
        ready: authenticatedStatus.authenticated,
        connected: authenticatedStatus.connected,
        authenticated: authenticatedStatus.authenticated,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: authenticatedStatus.authenticated ? attemptedAt : this.status.vts.lastSuccessAt,
        lastError: authenticatedStatus.authenticated
          ? null
          : authenticatedStatus.lastError ?? "VTube Studio is connected but not authenticated.",
      };
    } catch (error: unknown) {
      const latestStatus = this.vtsService.getStatus();
      return {
        ...this.status.vts,
        ready: latestStatus.connected && latestStatus.authenticated,
        connected: latestStatus.connected,
        authenticated: latestStatus.authenticated,
        lastAttemptAt: attemptedAt,
        lastError: error instanceof Error ? error.message : "Unable to activate VTube Studio.",
      };
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
