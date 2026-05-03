import { z } from "zod";
import { modelMonitorStartRequestSchema } from "./model-monitor.schema";
import type { VtsCueLabel, VtsEmoteKind } from "../types/vts.types";

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

export const vacancyOverlayConfigSchema = z
  .object({
    sourceName: z.string().trim().min(1).max(256),
    vacantEnterDelayMs: z.number().int().min(0).max(300000),
  })
  .strict();

const vtsCueLabelValues = [
  "greeting",
  "wave",
  "happy",
  "excited",
  "laughing",
  "evil_laugh",
  "smug",
  "angry",
  "frustrated",
  "shocked",
  "surprised",
  "sad",
  "crying",
  "cute_reaction",
  "love_reaction",
  "confused",
  "embarrassed",
  "sleepy",
  "dramatic_moment",
  "magic_moment",
  "hype_moment",
  "idle",
  "manual_request",
  "unknown",
  "vacant",
] as const satisfies readonly VtsCueLabel[];

const vtsEmoteKindValues = [
  "expression_reaction",
  "symbol_effect",
  "body_motion",
  "prop_effect",
  "appearance_toggle",
  "outfit_toggle",
  "reset",
  "unknown",
] as const satisfies readonly VtsEmoteKind[];

export const vtsCatalogOverrideSchema = z
  .object({
    cueLabels: z.array(z.enum(vtsCueLabelValues)).min(1),
    emoteKind: z.enum(vtsEmoteKindValues),
    autoMode: z.enum(["safe_auto", "suggest_only", "manual_only"]),
    confidence: z.number().min(0).max(1),
    hasAutoDeactivate: z.boolean().default(false),
    manualDeactivateAfterMs: z.number().int().min(500).max(300000).default(5000),
  })
  .strict();

export const appConfigSchema = z
  .object({
    vts: vtsConnectionConfigSchema,
    vtsCatalogOverrides: z.record(z.string().trim().min(1), vtsCatalogOverrideSchema),
    dashboard: dashboardConfigSchema,
    model: modelConfigSchema,
    monitor: monitorConfigSchema,
    vacancyOverlay: vacancyOverlayConfigSchema,
  })
  .strict();

export const settingsUpdateRequestSchema = appConfigSchema.partial().strict();

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
