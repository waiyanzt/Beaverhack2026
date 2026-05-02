export const IpcChannels = {
  GetAppVersion: "app:get-version",
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];