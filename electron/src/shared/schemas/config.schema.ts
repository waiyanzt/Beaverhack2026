import { z } from "zod";
import { modelMonitorStartRequestSchema } from "./model-monitor.schema";

export const vtsConnectionConfigSchema = z
  .object({
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535),
    pluginName: z.string().trim().min(3).max(32),
    pluginDeveloper: z.string().trim().min(3).max(32),
  })
  .strict();

export const dashboardConfigSchema = z
  .object({
    selectedAudioDeviceId: z.string().trim().min(1).max(512).nullable(),
    selectedVideoDeviceId: z.string().trim().min(1).max(512).nullable(),
    selectedScreenSourceId: z.string().trim().min(1).max(1024).nullable(),
  })
  .strict();

export const modelConfigSchema = z
  .object({
    selectedProviderId: z.enum(["openrouter", "vllm", "mock"]),
  })
  .strict();

export const monitorConfigSchema = z
  .object({
    resumeOnLaunch: z.boolean(),
    lastStartRequest: modelMonitorStartRequestSchema.nullable(),
  })
  .strict();

export const appConfigSchema = z
  .object({
    vts: vtsConnectionConfigSchema,
    dashboard: dashboardConfigSchema,
    model: modelConfigSchema,
    monitor: monitorConfigSchema,
  })
  .strict();

export const settingsUpdateRequestSchema = appConfigSchema.partial().strict();

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
