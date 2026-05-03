export const IpcChannels = {
  GetAppVersion: "app:get-version",
  ModelTestConnection: "model:test-connection",
  ModelListProviders: "model:list-providers",
  ModelSetProvider: "model:set-provider",
  VtsGetHotkeys: "vts:get-hotkeys",
  CaptureStart: "capture:start",
  CaptureStop: "capture:stop",
  CaptureStatus: "capture:status",
  CaptureListSources: "capture:list-sources",
  CaptureExportClip: "capture:export-clip",
  CaptureControl: "capture:control",
  CaptureFrame: "capture:frame",
  CaptureAudio: "capture:audio",
  CaptureClip: "capture:clip",
  CaptureLevel: "capture:level",
  CaptureError: "capture:error",
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];
