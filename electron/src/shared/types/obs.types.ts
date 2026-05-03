export interface ObsSourceState {
  name: string;
  visible: boolean;
}

export interface ObsSceneState {
  name: string;
  sources: ObsSourceState[];
}

export type ObsStatus =
  | {
      connected: false;
    }
  | {
      connected: true;
      currentScene: string;
      streamStatus: "live" | "inactive";
      recordingStatus: "active" | "inactive";
      scenes: ObsSceneState[];
    };
