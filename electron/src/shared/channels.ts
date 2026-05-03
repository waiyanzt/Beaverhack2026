export const IpcChannels = {
  GetAppVersion: "app:get-version",
  ModelTestConnection: "model:test-connection",
  ModelListProviders: "model:list-providers",
  ModelSetProvider: "model:set-provider",
  VtsGetHotkeys: "vts:get-hotkeys",
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];
