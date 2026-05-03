import WebSocket from "ws";
import { createId } from "../../utils/ids";
import {
  DEFAULT_CONFIG,
  settingsService,
  type SettingsService,
} from "../settings/settings.service";
import { vtsHotkeySchema } from "../../../shared/schemas/vts.schema";
import type { VtsConnectionConfig } from "../../../shared/types/config.types";
import type {
  VtsAuthenticationState,
  VtsConnectionState,
  VtsHotkey,
  VtsStatus,
} from "../../../shared/types/vts.types";

const VTS_API_NAME = "VTubeStudioPublicAPI";
const VTS_API_VERSION = "1.0";

type VtsSocket = Pick<WebSocket, "close" | "on" | "send"> & {
  readyState: number;
};

interface VtsApiEnvelope {
  apiName: string;
  apiVersion: string;
  requestID: string;
  messageType: string;
  data?: Record<string, unknown>;
}

interface PendingRequest {
  resolve: (response: VtsApiEnvelope) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface VtsServiceDependencies {
  createSocket?: (url: string) => VtsSocket;
  requestTimeoutMs?: number;
  settingsService?: Pick<SettingsService, "getSettings" | "updateVtsConfig">;
}

export class VtsService {
  private readonly createSocket: (url: string) => VtsSocket;
  private readonly requestTimeoutMs: number;
  private readonly settingsService: Pick<SettingsService, "getSettings" | "updateVtsConfig">;
  private socket: VtsSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private connectionState: VtsConnectionState = "disconnected";
  private authenticationState: VtsAuthenticationState = "unauthenticated";
  private config: VtsConnectionConfig;
  private hotkeys: VtsHotkey[] = [];
  private lastError: string | null = null;
  private token: string | null = null;
  private modelLoaded = false;
  private modelName: string | null = null;
  private modelId: string | null = null;
  private disconnecting = false;

  constructor(dependencies: VtsServiceDependencies = {}) {
    this.createSocket = dependencies.createSocket ?? ((url) => new WebSocket(url));
    this.requestTimeoutMs = dependencies.requestTimeoutMs ?? 5000;
    this.settingsService = dependencies.settingsService ?? settingsService;
    this.config = this.settingsService.getSettings().vts ?? DEFAULT_CONFIG.vts;
  }

  getStatus(): VtsStatus {
    return {
      connectionState: this.connectionState,
      authenticationState: this.authenticationState,
      connected: this.connectionState === "connected",
      authenticated: this.authenticationState === "authenticated",
      config: this.config,
      modelLoaded: this.modelLoaded,
      modelName: this.modelName,
      modelId: this.modelId,
      hotkeyCount: this.hotkeys.length,
      lastError: this.lastError,
    };
  }

  getCachedHotkeys(): VtsHotkey[] {
    return [...this.hotkeys];
  }

  async connect(config: VtsConnectionConfig): Promise<VtsStatus> {
    if (this.socket) {
      await this.disconnect();
    }

    this.config = this.settingsService.updateVtsConfig(config).vts;
    this.connectionState = "connecting";
    this.authenticationState = "unauthenticated";
    this.lastError = null;
    this.hotkeys = [];
    this.modelLoaded = false;
    this.modelName = null;
    this.modelId = null;

    const socket = this.createSocket(`ws://${this.config.host}:${this.config.port}`);
    this.attachSocket(socket);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out while connecting to VTube Studio."));
      }, this.requestTimeoutMs);

      socket.on("open", () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.connectionState = "connected";
        resolve();
      });

      socket.on("error", (error) => {
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error("Failed to connect to VTube Studio."));
      });
    }).catch((error: unknown) => {
      this.connectionState = "disconnected";
      this.lastError = this.toMessage(error, "Failed to connect to VTube Studio.");
      throw error;
    });

    return this.getStatus();
  }

  async disconnect(): Promise<VtsStatus> {
    this.disconnecting = true;
    this.rejectPendingRequests(new Error("Disconnected from VTube Studio."));

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connectionState = "disconnected";
    this.authenticationState = "unauthenticated";
    this.hotkeys = [];
    this.modelLoaded = false;
    this.modelName = null;
    this.modelId = null;
    this.disconnecting = false;

    return this.getStatus();
  }

  async authenticate(): Promise<VtsStatus> {
    this.ensureConnected();
    this.authenticationState = "authenticating";
    this.lastError = null;

    try {
      const tokenResponse = await this.sendRequest("AuthenticationTokenRequest", {
        pluginName: this.config.pluginName,
        pluginDeveloper: this.config.pluginDeveloper,
      }, 30000);
      const token = this.readString(tokenResponse.data, "authenticationToken");

      await this.authenticateWithToken(token);
      await this.getHotkeys();

      return this.getStatus();
    } catch (error: unknown) {
      this.authenticationState = "unauthenticated";
      this.lastError = this.toMessage(error, "Failed to authenticate with VTube Studio.");
      throw error;
    }
  }

  async getHotkeys(): Promise<VtsHotkey[]> {
    this.ensureAuthenticated();

    try {
      const response = await this.sendRequest("HotkeysInCurrentModelRequest", {});
      const responseData = response.data ?? {};
      const modelLoaded = Boolean(responseData.modelLoaded);
      const availableHotkeys = Array.isArray(responseData.availableHotkeys)
        ? responseData.availableHotkeys
        : [];

      this.modelLoaded = modelLoaded;
      this.modelName = this.readOptionalString(responseData, "modelName");
      this.modelId = this.readOptionalString(responseData, "modelID");
      this.hotkeys = availableHotkeys.map((hotkey) => {
        const parsed = vtsHotkeySchema.parse(hotkey);
        return {
          hotkeyID: parsed.hotkeyID,
          name: parsed.name,
          type: parsed.type,
          description: parsed.description ?? null,
          file: parsed.file ?? null,
        };
      });

      return [...this.hotkeys];
    } catch (error: unknown) {
      this.lastError = this.toMessage(error, "Failed to fetch VTube Studio hotkeys.");
      throw error;
    }
  }

  async triggerHotkey(hotkeyId: string): Promise<string> {
    this.ensureAuthenticated();

    try {
      const response = await this.sendRequest("HotkeyTriggerRequest", {
        hotkeyID: hotkeyId,
      });
      const triggeredHotkeyId = this.readString(response.data, "hotkeyID");
      this.lastError = null;
      return triggeredHotkeyId;
    } catch (error: unknown) {
      this.lastError = this.toMessage(error, "Failed to trigger VTube Studio hotkey.");
      throw error;
    }
  }

  private async authenticateWithToken(token: string): Promise<void> {
    const response = await this.sendRequest("AuthenticationRequest", {
      pluginName: this.config.pluginName,
      pluginDeveloper: this.config.pluginDeveloper,
      authenticationToken: token,
    });
    const authenticated = Boolean(response.data?.authenticated);
    const reason = this.readOptionalString(response.data ?? {}, "reason");

    if (!authenticated) {
      throw new Error(reason ?? "VTube Studio rejected authentication.");
    }

    this.token = token;
    this.authenticationState = "authenticated";
    this.lastError = null;
  }

  private attachSocket(socket: VtsSocket): void {
    socket.on("message", (payload) => {
      this.handleMessage(payload);
    });

    socket.on("close", () => {
      this.rejectPendingRequests(new Error("Disconnected from VTube Studio."));
      this.socket = null;
      this.connectionState = "disconnected";
      this.authenticationState = "unauthenticated";

      if (!this.disconnecting) {
        this.lastError = "VTube Studio closed the connection.";
      }
    });
  }

  private handleMessage(payload: unknown): void {
    const rawPayload =
      typeof payload === "string"
        ? payload
        : Buffer.isBuffer(payload)
          ? payload.toString("utf8")
          : Array.isArray(payload)
            ? Buffer.concat(payload).toString("utf8")
            : String(payload);

    let envelope: VtsApiEnvelope;

    try {
      envelope = JSON.parse(rawPayload) as VtsApiEnvelope;
    } catch {
      this.lastError = "Received an invalid response from VTube Studio.";
      return;
    }

    const pending = this.pendingRequests.get(envelope.requestID);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(envelope.requestID);

    if (envelope.messageType === "APIError") {
      pending.reject(new Error(this.readOptionalString(envelope.data ?? {}, "message") ?? "VTube Studio API error."));
      return;
    }

    pending.resolve(envelope);
  }

  private sendRequest(
    messageType: string,
    data: Record<string, unknown>,
    timeoutMs: number = this.requestTimeoutMs,
  ): Promise<VtsApiEnvelope> {
    this.ensureConnected();

    return new Promise<VtsApiEnvelope>((resolve, reject) => {
      const requestID = createId("vts");
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestID);
        reject(new Error(`Timed out waiting for ${messageType}.`));
      }, timeoutMs);

      this.pendingRequests.set(requestID, { resolve, reject, timer });

      const payload: VtsApiEnvelope = {
        apiName: VTS_API_NAME,
        apiVersion: VTS_API_VERSION,
        requestID,
        messageType,
        data,
      };

      try {
        this.socket?.send(JSON.stringify(payload));
      } catch (error: unknown) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestID);
        reject(error instanceof Error ? error : new Error("Failed to send VTube Studio request."));
      }
    });
  }

  private rejectPendingRequests(error: Error): void {
    for (const [requestID, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(requestID);
    }
  }

  private ensureConnected(): void {
    if (!this.socket || this.connectionState !== "connected") {
      throw new Error("VTube Studio is not connected.");
    }
  }

  private ensureAuthenticated(): void {
    this.ensureConnected();

    if (this.authenticationState !== "authenticated") {
      throw new Error("VTube Studio is not authenticated.");
    }
  }

  private readString(data: Record<string, unknown> | undefined, key: string): string {
    const value = data?.[key];

    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`VTube Studio response is missing ${key}.`);
    }

    return value;
  }

  private readOptionalString(data: Record<string, unknown>, key: string): string | null {
    const value = data[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}

export const vtsService = new VtsService();
