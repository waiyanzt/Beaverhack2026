import { createHash } from "node:crypto";
import WebSocket from "ws";
import { createId } from "../../utils/ids";
import {
  DEFAULT_CONFIG,
  settingsService,
  type SettingsService,
} from "../settings/settings.service";
import { vtsHotkeySchema } from "../../../shared/schemas/vts.schema";
import type { VtsConnectionConfig, VtsEmoteMappingConfig } from "../../../shared/types/config.types";
import type {
  VtsAuthenticationState,
  VtsCatalogEntry,
  VtsCatalogSummary,
  VtsConnectionState,
  VtsHotkey,
  VtsReadinessState,
  VtsStatus,
} from "../../../shared/types/vts.types";

const VTS_API_NAME = "VTubeStudioPublicAPI";
const VTS_API_VERSION = "1.0";
const EMPTY_CATALOG: VtsCatalogSummary = {
  version: null,
  hotkeyHash: null,
  totalEntries: 0,
  safeAutoCount: 0,
  suggestOnlyCount: 0,
  manualOnlyCount: 0,
  entries: [],
};

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
  private catalog: VtsCatalogSummary = EMPTY_CATALOG;

  constructor(dependencies: VtsServiceDependencies = {}) {
    this.createSocket = dependencies.createSocket ?? ((url) => new WebSocket(url));
    this.requestTimeoutMs = dependencies.requestTimeoutMs ?? 5000;
    this.settingsService = dependencies.settingsService ?? settingsService;
    this.config = this.settingsService.getSettings().vts ?? DEFAULT_CONFIG.vts;
  }

  getStatus(): VtsStatus {
    this.refreshCatalog();
    const readinessState = this.getReadinessState();
    return {
      connectionState: this.connectionState,
      authenticationState: this.authenticationState,
      readinessState,
      readyForAutomation: readinessState === "ready",
      connected: this.connectionState === "connected",
      authenticated: this.authenticationState === "authenticated",
      config: this.config,
      modelLoaded: this.modelLoaded,
      modelName: this.modelName,
      modelId: this.modelId,
      hotkeyCount: this.hotkeys.length,
      catalog: this.getCatalog(),
      lastError: this.lastError,
    };
  }

  getCachedHotkeys(): VtsHotkey[] {
    return [...this.hotkeys];
  }

  getCatalog(): VtsCatalogSummary {
    this.refreshCatalog();
    return {
      ...this.catalog,
      entries: [...this.catalog.entries],
    };
  }

  resolveCatalogEntry(catalogId: string): VtsCatalogEntry | null {
    this.refreshCatalog();
    return this.catalog.entries.find((entry) => entry.catalogId === catalogId) ?? null;
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
    this.catalog = EMPTY_CATALOG;
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
    this.catalog = EMPTY_CATALOG;
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
      const token = this.token ?? await this.requestAuthenticationToken();

      await this.authenticateWithToken(token);
      await this.getHotkeys();

      return this.getStatus();
    } catch (error: unknown) {
      this.authenticationState = "unauthenticated";
      this.lastError = this.toMessage(error, "Failed to authenticate with VTube Studio.");
      throw error;
    }
  }

  private async requestAuthenticationToken(): Promise<string> {
    const tokenResponse = await this.sendRequest("AuthenticationTokenRequest", {
      pluginName: this.config.pluginName,
      pluginDeveloper: this.config.pluginDeveloper,
    }, 30000);

    return this.readString(tokenResponse.data, "authenticationToken");
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
          name: this.normalizeHotkeyName(parsed.hotkeyID, parsed.name),
          type: parsed.type,
          description: parsed.description ?? null,
          file: parsed.file ?? null,
        };
      });
      this.refreshCatalog();

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

  private normalizeHotkeyName(hotkeyId: string, name: string): string {
    const trimmedName = name.trim();

    if (trimmedName.length > 0) {
      return trimmedName;
    }

    return `Unnamed Hotkey (${hotkeyId})`;
  }

  private getReadinessState(): VtsReadinessState {
    if (this.connectionState === "connecting") {
      return "connecting";
    }

    if (this.connectionState !== "connected") {
      return "not_running";
    }

    if (this.authenticationState === "authenticating") {
      return "authenticating";
    }

    if (this.authenticationState !== "authenticated") {
      return "unauthenticated";
    }

    if (!this.modelLoaded) {
      return "no_model_loaded";
    }

    if (this.hotkeys.length === 0) {
      return "no_hotkeys";
    }

    if (!this.catalog.version) {
      return "catalog_building";
    }

    return "ready";
  }

  private refreshCatalog(): void {
    this.config = this.settingsService.getSettings().vts;
    this.catalog = this.buildCatalog(this.hotkeys, this.config.emoteMappings);
  }

  private buildCatalog(hotkeys: VtsHotkey[], mappings: VtsEmoteMappingConfig[]): VtsCatalogSummary {
    const availableHotkeys = new Map(hotkeys.map((hotkey) => [hotkey.hotkeyID, hotkey]));
    const enabledMappings = mappings.filter((mapping) => mapping.enabled && availableHotkeys.has(mapping.hotkeyId));

    const hotkeyHash = createHash("sha256")
      .update(
        enabledMappings
          .map((mapping) => `${mapping.hotkeyId}:${this.normalizeCatalogToken(mapping.name)}:${mapping.description.trim()}`)
          .sort()
          .join("|"),
      )
      .digest("hex");
    const version = `vts_catalog_${hotkeyHash.slice(0, 12)}`;
    const seenCatalogIds = new Map<string, number>();
    const entries = enabledMappings.map((mapping) => {
      const hotkey = availableHotkeys.get(mapping.hotkeyId);
      if (!hotkey) {
        throw new Error(`VTS emote mapping "${mapping.name}" points to an unavailable hotkey.`);
      }

      const normalizedName = this.normalizeCatalogToken(mapping.name);
      const intent = normalizedName.replace(/\s+/g, "_") || "emote";
      const catalogBase = intent.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "emote";
      const seenCount = (seenCatalogIds.get(catalogBase) ?? 0) + 1;
      seenCatalogIds.set(catalogBase, seenCount);
      const catalogId = seenCount === 1 ? catalogBase : `${catalogBase}_${seenCount}`;

      return {
        catalogId,
        hotkeyId: hotkey.hotkeyID,
        hotkeyName: hotkey.name,
        promptName: mapping.name.trim(),
        promptDescription: mapping.description.trim(),
        normalizedName,
        intent,
        autoMode: "safe_auto",
      } satisfies VtsCatalogEntry;
    });

    return {
      version,
      hotkeyHash,
      totalEntries: entries.length,
      safeAutoCount: entries.filter((entry) => entry.autoMode === "safe_auto").length,
      suggestOnlyCount: entries.filter((entry) => entry.autoMode === "suggest_only").length,
      manualOnlyCount: entries.filter((entry) => entry.autoMode === "manual_only").length,
      entries,
    };
  }

  private normalizeCatalogToken(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
      this.hotkeys = [];
      this.catalog = EMPTY_CATALOG;
      this.modelLoaded = false;
      this.modelName = null;
      this.modelId = null;

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
