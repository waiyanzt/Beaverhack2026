import { ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";
import { automationAnalyzeNowRequestSchema } from "../../shared/schemas/automation.schema";
import type { PipelineService } from "../services/automation/pipeline.service";

export function registerAutomationIpcHandlers(pipelineService: PipelineService): void {
  ipcMain.handle(IpcChannels.AutomationAnalyzeNow, async (_event, input: unknown) => {
    const parsed = automationAnalyzeNowRequestSchema.safeParse(input ?? {});

    if (!parsed.success) {
      return {
        ok: false as const,
        message: "Invalid automation request.",
      };
    }

    try {
      return await pipelineService.analyzeNow(parsed.data);
    } catch (error: unknown) {
      console.error("Failed to run automation analysis:", error);
      return {
        ok: false as const,
        message: "Unable to run automation analysis.",
      };
    }
  });
}
