import { app, ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";
import { modelMonitorStartRequestSchema } from "../../shared/schemas/model-monitor.schema";
import { captureOrchestrator } from "../services/capture/capture-orchestrator.instance";
import { ModelMonitorService } from "../services/model/model-monitor.service";
import { ModelRouterService } from "../services/model/model-router.service";
import { OpenAICompatibleProvider } from "../services/model/openai-compatible.provider";
import {
  getModelProviders,
  getSelectedModelProviderId,
  setSelectedModelProviderId,
} from "../services/model/model-provider-store";
import { registerVtsIpcHandlers } from "./vts.ipc";
import { registerCaptureIpcHandlers } from "./capture.ipc";

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

const modelMonitor = new ModelMonitorService(captureOrchestrator, modelRouter);

export function registerIpcHandlers(): void {
  registerCaptureIpcHandlers();

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

  ipcMain.handle(IpcChannels.ModelMonitorStart, async (event, input: unknown) => {
    const parsed = modelMonitorStartRequestSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false as const,
        message: "Invalid model monitor configuration.",
        status: modelMonitor.getStatus(),
      };
    }

    try {
      const status = await modelMonitor.start(parsed.data, event.sender);
      return { ok: true as const, status };
    } catch (error: unknown) {
      console.error("Failed to start model monitor:", error);
      return {
        ok: false as const,
        message: "Unable to start model monitor.",
        status: modelMonitor.getStatus(),
      };
    }
  });

  ipcMain.handle(IpcChannels.ModelMonitorStop, async () => {
    try {
      const status = await modelMonitor.stop();
      return { ok: true as const, status };
    } catch (error: unknown) {
      console.error("Failed to stop model monitor:", error);
      return {
        ok: false as const,
        message: "Unable to stop model monitor.",
        status: modelMonitor.getStatus(),
      };
    }
  });

  ipcMain.handle(IpcChannels.ModelMonitorStatus, () => {
    try {
      return { ok: true as const, status: modelMonitor.getStatus() };
    } catch (error: unknown) {
      console.error("Failed to get model monitor status:", error);
      return {
        ok: false as const,
        message: "Unable to get model monitor status.",
        status: modelMonitor.getStatus(),
      };
    }
  });

  registerVtsIpcHandlers();
}
