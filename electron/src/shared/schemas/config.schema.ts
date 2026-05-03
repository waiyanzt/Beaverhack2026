import { z } from "zod";
import { modelMonitorStartRequestSchema } from "./model-monitor.schema";
import { DEFAULT_VTS_CUE_LABELS } from "../vts-cue-labels";
import type { VtsEmoteKind } from "../types/vts.types";

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

export const vtsCueLabelIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "Cue label IDs must use lowercase letters, numbers, underscores, or hyphens.");

export const vtsCueLabelDefinitionSchema = z
  .object({
    id: vtsCueLabelIdSchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240).default(""),
  })
  .strict();

export const vtsCueLabelsSchema = z
  .array(vtsCueLabelDefinitionSchema)
  .min(1)
  .max(80)
  .superRefine((labels, context) => {
    const seen = new Set<string>();

    for (const label of labels) {
      if (seen.has(label.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate cue label ID "${label.id}".`,
        });
      }

      seen.add(label.id);
    }
  });

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
    cueLabels: z.array(vtsCueLabelIdSchema).min(1),
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
    vtsCueLabels: vtsCueLabelsSchema.default(DEFAULT_VTS_CUE_LABELS),
    vtsCatalogOverrides: z.record(z.string().trim().min(1), vtsCatalogOverrideSchema),
    dashboard: dashboardConfigSchema,
    model: modelConfigSchema,
    monitor: monitorConfigSchema,
  })
  .strict();

export const settingsUpdateRequestSchema = appConfigSchema.partial().strict();

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
