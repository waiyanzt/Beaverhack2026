export type ServiceActivationTrigger = "startup" | "manual" | "auto_retry";

export interface ServiceActivationTargetStatus {
  ready: boolean;
  connected: boolean;
  authenticated?: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface ServiceActivationStatus {
  inFlight: boolean;
  retryScheduled: boolean;
  lastTrigger: ServiceActivationTrigger | null;
  obs: ServiceActivationTargetStatus;
  vts: ServiceActivationTargetStatus;
}

export type ServiceActivationStatusResult =
  | { ok: true; status: ServiceActivationStatus }
  | { ok: false; message: string; status: ServiceActivationStatus };

