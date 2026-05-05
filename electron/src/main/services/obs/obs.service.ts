import type { ObsSceneState, ObsSourceState, ObsStatus } from "../../../shared/types/obs.types";

type OBSWebSocketModule = typeof import("obs-websocket-js");
type OBSWebSocketInstance = InstanceType<OBSWebSocketModule["default"]>;
type OBSWebSocketLike = Pick<OBSWebSocketInstance, "connect" | "disconnect" | "call" | "on">;

export interface ObsServiceClientFactory {
  create(): Promise<OBSWebSocketLike>;
}

class DefaultObsServiceClientFactory implements ObsServiceClientFactory {
  public async create(): Promise<OBSWebSocketLike> {
    const { default: OBSWebSocket } = await import("obs-websocket-js");
    return new OBSWebSocket();
  }
}

export class ObsService {
  private ws: OBSWebSocketLike | null = null;
  private connected = false;

  public constructor(
    private readonly clientFactory: ObsServiceClientFactory = new DefaultObsServiceClientFactory(),
  ) {}

  public async connect(host = "localhost", port = 4455): Promise<void> {
    if (this.ws) {
      await this.disconnect();
    }

    const client = await this.clientFactory.create();
    client.on("ConnectionClosed", () => {
      this.connected = false;
      console.log("[OBS] Connection closed");
    });
    client.on("ConnectionError", (error) => {
      console.error("[OBS] WebSocket error:", error);
    });
    client.on("CurrentProgramSceneChanged", (event) => {
      console.log("[OBS] Scene changed:", event);
    });
    client.on("StreamStateChanged", (event) => {
      console.log("[OBS] Stream state changed:", event);
    });
    client.on("RecordStateChanged", (event) => {
      console.log("[OBS] Record state changed:", event);
    });
    client.on("SceneItemEnableStateChanged", (event) => {
      console.log("[OBS] Source visibility changed:", event);
    });

    await client.connect(`ws://${host}:${port}`);
    this.ws = client;
    this.connected = true;
    console.log(`[OBS] Connected to ws://${host}:${port}`);
  }

  public async disconnect(): Promise<void> {
    if (this.ws) {
      await this.ws.disconnect();
      this.ws = null;
    }

    this.connected = false;
  }

  public async getStatus(): Promise<ObsStatus> {
    if (!this.ws || !this.connected) {
      return { connected: false };
    }

    try {
      const ws = this.getConnectedClient();
      const [sceneData, streamData, recordData] = await Promise.all([
        ws.call("GetSceneList"),
        ws.call("GetStreamStatus"),
        ws.call("GetRecordStatus"),
      ]);

      const rawScenes = Array.isArray(sceneData.scenes) ? sceneData.scenes : [];
      const scenes = await Promise.all(
        rawScenes.map(async (rawScene): Promise<ObsSceneState> => {
          const sceneName = String((rawScene as { sceneName?: unknown }).sceneName ?? "");
          const sceneItems = await ws.call("GetSceneItemList", { sceneName });
          const sources: ObsSourceState[] = Array.isArray(sceneItems?.sceneItems)
            ? sceneItems.sceneItems.map((item) => ({
                name: String((item as { sourceName?: unknown }).sourceName ?? ""),
                visible: Boolean((item as { sceneItemEnabled?: unknown }).sceneItemEnabled),
              }))
            : [];

          return {
            name: sceneName,
            sources,
          };
        }),
      );

      return {
        connected: true,
        currentScene: String(sceneData.currentProgramSceneName),
        streamStatus: streamData.outputActive ? "live" : "inactive",
        recordingStatus: recordData.outputActive ? "active" : "inactive",
        scenes,
      };
    } catch (error: unknown) {
      console.error("[OBS] Failed to get status:", error);
      return { connected: false };
    }
  }

  public async setCurrentScene(sceneName: string): Promise<void> {
    const ws = this.getConnectedClient();
    await ws.call("SetCurrentProgramScene", { sceneName });
  }

  public async setSourceVisibility(
    sceneName: string,
    sourceName: string,
    visible: boolean,
  ): Promise<void> {
    const ws = this.getConnectedClient();

    const sceneItems = await ws.call("GetSceneItemList", { sceneName });
    const item = Array.isArray(sceneItems.sceneItems)
      ? sceneItems.sceneItems.find(
          (candidate: unknown) => String((candidate as { sourceName?: unknown }).sourceName ?? "") === sourceName,
        )
      : null;

    if (!item) {
      throw new Error(`Source "${sourceName}" was not found in scene "${sceneName}".`);
    }

    const sceneItemId = Number((item as { sceneItemId?: unknown }).sceneItemId);
    if (!Number.isFinite(sceneItemId)) {
      throw new Error(`Source "${sourceName}" in scene "${sceneName}" has no valid scene item id.`);
    }

    await ws.call("SetSceneItemEnabled", {
      sceneName,
      sceneItemId,
      sceneItemEnabled: visible,
    });
  }

  private getConnectedClient(): OBSWebSocketLike {
    if (!this.ws || !this.connected) {
      throw new Error("OBS is not connected.");
    }

    return this.ws;
  }
}

export const obsService = new ObsService();

export async function obsConnect(host = "localhost", port = 4455): Promise<void> {
  await obsService.connect(host, port);
}

export async function obsDisconnect(): Promise<void> {
  await obsService.disconnect();
}

export async function obsGetStatus(): Promise<ObsStatus> {
  return obsService.getStatus();
}
