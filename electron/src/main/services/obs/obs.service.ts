export type ObsConnectionStatus =
  | { connected: false }
  | {
      connected: true;
      currentScene: string;
      scenes: string[];
      streaming: boolean;
      recording: boolean;
      sources: unknown[];
    };

type OBSWebSocketInstance = InstanceType<typeof import("obs-websocket-js")["default"]>;

let ws: OBSWebSocketInstance | null = null;
let connected = false;

export async function obsConnect(host = "localhost", port = 4455): Promise<void> {
  if (ws) {
    await obsDisconnect();
  }

  const { default: OBSWebSocket } = await import("obs-websocket-js");
  ws = new OBSWebSocket();

  ws.on("ConnectionClosed", () => {
    connected = false;
    console.log("[OBS] Connection closed");
  });

  ws.on("ConnectionError", (err) => {
    console.error("[OBS] WebSocket error:", err);
  });

  ws.on("CurrentProgramSceneChanged", (e) => {
    console.log("[OBS] Scene changed:", e.sceneName);
  });

  ws.on("StreamStateChanged", (e) => {
    console.log("[OBS] Stream:", e.outputActive ? "started" : "stopped");
  });

  ws.on("RecordStateChanged", (e) => {
    console.log("[OBS] Recording:", e.outputActive ? "started" : "stopped");
  });

  ws.on("SceneItemEnableStateChanged", (e) => {
    console.log("[OBS] Source toggled:", e.sceneItemId, "enabled:", e.sceneItemEnabled);
  });

  await ws.connect(`ws://${host}:${port}`);
  connected = true;
  console.log(`[OBS] Connected to ws://${host}:${port}`);
}

export async function obsDisconnect(): Promise<void> {
  if (ws) {
    await ws.disconnect();
    ws = null;
  }
  connected = false;
}

export async function obsGetStatus(): Promise<ObsConnectionStatus> {
  if (!ws || !connected) {
    return { connected: false };
  }

  try {
    const [sceneData, streamData, recordData] = await Promise.all([
      ws.call("GetSceneList"),
      ws.call("GetStreamStatus"),
      ws.call("GetRecordStatus"),
    ]);

    const sceneItems = await ws.call("GetSceneItemList", {
      sceneName: sceneData.currentProgramSceneName,
    });

    return {
      connected: true,
      currentScene: sceneData.currentProgramSceneName,
      scenes: sceneData.scenes.map((s) => String(s.sceneName)),
      streaming: streamData.outputActive,
      recording: recordData.outputActive,
      sources: sceneItems.sceneItems,
    };
  } catch (err) {
    console.error("[OBS] Failed to get status:", err);
    return { connected: false };
  }
}
