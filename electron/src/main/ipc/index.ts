import { app, ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";
import { ModelRouterService } from "../services/model/model-router.service";
import { OpenAICompatibleProvider } from "../services/model/openai-compatible.provider";
import {
  getModelProviders,
  getSelectedModelProviderId,
  setSelectedModelProviderId,
} from "../services/model/model-provider-store";

const modelRouter = new ModelRouterService(
  {
    getProviders: getModelProviders,
    getSelectedProviderId: getSelectedModelProviderId,
  },
  new OpenAICompatibleProvider({
    postJson: async (url, body, headers) => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      return {
        status: response.status,
        body: await response.text(),
      };
    },
  }),
);

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.GetAppVersion, () => {
    try {
      return app.getVersion();
    } catch (error: unknown) {
      console.error("Failed to resolve app version:", error);
      return "unknown";
    }
  });

  ipcMain.handle(IpcChannels.ModelListProviders, () => {
    try {
      return getModelProviders();
    } catch (error: unknown) {
      console.error("Failed to list model providers:", error);
      return [];
    }
  });

  ipcMain.handle(IpcChannels.ModelSetProvider, (_event, providerId: unknown) => {
    try {
      if (providerId === "openrouter" || providerId === "vllm" || providerId === "mock") {
        setSelectedModelProviderId(providerId);
        return { ok: true as const };
      }

      return { ok: false as const, message: "Invalid provider id." };
    } catch (error: unknown) {
      console.error("Failed to set model provider:", error);
      return { ok: false as const, message: "Unable to update provider." };
    }
  });

  ipcMain.handle(IpcChannels.ModelTestConnection, async () => {
    try {
      return await modelRouter.testConnection();
    } catch (error: unknown) {
      console.error("Failed to test model provider connection:", error);
      return {
        providerId: getSelectedModelProviderId(),
        ok: false,
        status: null,
        message: "Connection test failed.",
      };
    }
  });
}
