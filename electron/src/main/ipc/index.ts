import { app, ipcMain, type WebContents } from "electron";
import { IpcChannels } from "../../shared/channels";
import { actionPlanSchema } from "../../shared/schemas/action-plan.schema";
import { modelMonitorStartRequestSchema } from "../../shared/schemas/model-monitor.schema";
import { modelControlContextSchema } from "../../shared/schemas/observation.schema";
import type { AutomationAnalyzeNowRequest } from "../../shared/types/action-plan.types";
import { ActionExecutorService } from "../services/automation/action-executor.service";
import { ActionPlanParserService } from "../services/automation/action-plan-parser.service";
import { ActionValidatorService } from "../services/automation/action-validator.service";
import { CooldownService } from "../services/automation/cooldown.service";
import { ObservationBuilderService } from "../services/automation/observation-builder.service";
import { PipelineService } from "../services/automation/pipeline.service";
import { PromptBuilderService } from "../services/automation/prompt-builder.service";
import { captureOrchestrator } from "../services/capture/capture-orchestrator.instance";
import { ModelMonitorService } from "../services/model/model-monitor.service";
import { ModelRouterService } from "../services/model/model-router.service";
import { OpenAICompatibleProvider } from "../services/model/openai-compatible.provider";
import {
  getModelProviders,
  getSelectedModelProviderId,
  setSelectedModelProviderId,
} from "../services/model/model-provider-store";
import { obsService } from "../services/obs/obs.service";
import { settingsService } from "../services/settings/settings.service";
import { vtsService } from "../services/vts/vts.service";
import { registerCaptureIpcHandlers } from "./capture.ipc";
import { registerSettingsIpcHandlers } from "./settings.ipc";
import { registerVtsIpcHandlers } from "./vts.ipc";

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

const cooldownService = new CooldownService();
const pipelineService = new PipelineService(
  new ObservationBuilderService(obsService, vtsService, cooldownService),
  new PromptBuilderService(),
  modelRouter,
  new ActionPlanParserService(),
  new ActionValidatorService(cooldownService),
  new ActionExecutorService(obsService, vtsService, cooldownService),
  cooldownService,
);
const modelMonitor = new ModelMonitorService(captureOrchestrator, modelRouter);

export async function resumePersistedModelMonitor(owner: WebContents): Promise<void> {
  const { monitor } = settingsService.getSettings();

  if (!monitor.resumeOnLaunch || !monitor.lastStartRequest || modelMonitor.getStatus().running) {
    return;
  }

  try {
    await modelMonitor.start(monitor.lastStartRequest, owner);
  } catch (error: unknown) {
    console.error("Failed to resume persisted model monitor:", error);
    settingsService.updateMonitorSession(monitor.lastStartRequest, false);
  }
}

export function registerIpcHandlers(): void {
  registerCaptureIpcHandlers();
  registerSettingsIpcHandlers();

  ipcMain.handle(IpcChannels.GetAppVersion, () => {
    try {
      return app.getVersion();
    } catch (error: unknown) {
      console.error("Failed to resolve app version:", error);
      return "unknown";
    }
  });

  ipcMain.handle(IpcChannels.AutomationAnalyzeNow, async (_event, request: AutomationAnalyzeNowRequest | undefined) => {
    try {
      const result = await pipelineService.analyzeNow(request ?? {});

      if (result.ok) {
        modelControlContextSchema.parse(result.modelContext);
        actionPlanSchema.parse(result.plan);
      }

      return result;
    } catch (error: unknown) {
      console.error("Failed to run automation analysis:", error);
      return {
        ok: false as const,
        message: "Unable to run automation analysis.",
      };
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
      settingsService.updateMonitorSession(parsed.data, true);
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
      settingsService.updateMonitorSession(settingsService.getSettings().monitor.lastStartRequest, false);
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
