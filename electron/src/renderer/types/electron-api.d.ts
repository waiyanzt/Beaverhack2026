export {};

declare global {
  interface Window {
    desktop?: {
      getAppVersion: () => Promise<string>;
      getHotkeys: () => Promise<unknown>;
    };
  }
}
