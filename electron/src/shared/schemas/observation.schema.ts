import { z } from "zod";
import { actionPlanSchema } from "./action-plan.schema";
import { vtsCueLabelIdSchema } from "./config.schema";

const supportedActionTypeSchema = z.enum([
  "vts.trigger_hotkey",
  "vts.set_parameter",
  "obs.set_scene",
  "obs.set_source_visibility",
  "overlay.message",
  "log.event",
  "noop",
]);

export const modelControlVtsHotkeySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .strict();

export const modelControlVtsCatalogItemSchema = z
  .object({
    catalogId: z.string().trim().min(1),
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    cueLabels: z.array(vtsCueLabelIdSchema).min(1),
    emoteKind: z.enum([
      "expression_reaction",
      "symbol_effect",
      "body_motion",
      "prop_effect",
      "appearance_toggle",
      "outfit_toggle",
      "reset",
      "unknown",
    ]),
    autoMode: z.enum(["safe_auto", "suggest_only", "manual_only"]),
  })
  .strict();

export const modelControlVtsCatalogStateSchema = z
  .object({
    version: z.string().nullable(),
    readinessState: z.enum([
      "not_running",
      "connecting",
      "unauthenticated",
      "authenticating",
      "authenticated",
      "no_model_loaded",
      "no_hotkeys",
      "catalog_building",
      "ready",
    ]),
    readyForAutomation: z.boolean(),
    safeAutoCount: z.number().int().nonnegative(),
    suggestOnlyCount: z.number().int().nonnegative(),
    manualOnlyCount: z.number().int().nonnegative(),
    candidates: z.array(modelControlVtsCatalogItemSchema),
  })
  .strict();

export const modelControlVtsStateSchema = z
  .object({
    connected: z.boolean(),
    authenticated: z.boolean(),
    currentModelName: z.string().nullable(),
    availableHotkeys: z.array(modelControlVtsHotkeySchema),
    automationCatalog: modelControlVtsCatalogStateSchema,
  })
  .strict();

export const modelControlObsSourceSchema = z
  .object({
    name: z.string().trim().min(1),
    visible: z.boolean(),
  })
  .strict();

export const modelControlObsSceneSchema = z
  .object({
    name: z.string().trim().min(1),
    sources: z.array(modelControlObsSourceSchema),
  })
  .strict();

export const modelControlObsStateSchema = z
  .object({
    connected: z.boolean(),
    currentScene: z.string().nullable(),
    streamStatus: z.enum(["live", "inactive"]),
    recordingStatus: z.enum(["active", "inactive"]),
    scenes: z.array(modelControlObsSceneSchema),
  })
  .strict();

export const modelControlPolicySchema = z
  .object({
    allowedActions: z.array(supportedActionTypeSchema),
  })
  .strict();

export const modelControlRecentActionSchema = z
  .object({
    actionId: z.string().trim().min(1),
    type: supportedActionTypeSchema,
    target: z.string().nullable(),
    label: z.string().trim().min(1),
    timestamp: z.string().datetime(),
  })
  .strict();

export const modelControlRecentModelActionResultSchema = z
  .object({
    actionId: z.string().trim().min(1),
    type: supportedActionTypeSchema,
    status: z.enum(["executed", "blocked", "failed", "confirmation_required", "noop", "not_executed"]),
    reason: z.string().trim().min(1),
    errorMessage: z.string().optional(),
  })
  .strict();

export const modelControlRecentModelActionSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    storedAt: z.string().datetime(),
    actionPlan: actionPlanSchema,
    actionResults: z.array(modelControlRecentModelActionResultSchema),
  })
  .strict();

export const modelControlRecentActionSummarySchema = z
  .object({
    catalogId: z.string().trim().min(1),
    actionType: supportedActionTypeSchema,
    ageMs: z.number().int().nonnegative(),
    status: z.enum(["executed", "blocked", "failed", "confirmation_required", "noop", "not_executed"]),
    blockedReasonCode: z.enum(["cooldown", "policy", "unknown"]).optional(),
  })
  .strict();

export const modelControlContextSchema = z
  .object({
    tickId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    transcript: z.string().nullable(),
    services: z
      .object({
        vts: modelControlVtsStateSchema,
        obs: modelControlObsStateSchema,
        policy: modelControlPolicySchema,
      })
      .strict(),
    context: z
      .object({
        autonomyLevel: z.enum(["manual", "auto_safe", "auto_full"]),
        recentActions: z.array(modelControlRecentActionSchema),
        recentModelActions: z.array(modelControlRecentModelActionSchema),
        recentActionSummary: z.array(modelControlRecentActionSummarySchema),
        cooldowns: z.record(z.string(), z.number().int().nonnegative()),
        cooldownSummary: z.record(z.string(), z.object({ remainingMs: z.number().int().nonnegative() }).strict()),
      })
      .strict(),
  })
  .strict();

export type ModelControlContextSchema = z.infer<typeof modelControlContextSchema>;
