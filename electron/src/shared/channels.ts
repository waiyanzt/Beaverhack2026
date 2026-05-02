export const IpcChannels = {
  GetAppVersion: "app:get-version",
  ModelTestConnection: "model:test-connection",
  ModelListProviders: "model:list-providers",
  ModelSetProvider: "model:set-provider",
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];
