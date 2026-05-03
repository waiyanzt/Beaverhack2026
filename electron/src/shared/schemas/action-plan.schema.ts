import { z } from "zod";
import { vtsCueLabelIdSchema } from "./config.schema";

export const triggerVtsHotkeyActionSchema = z
  .object({
    type: z.literal("vts.trigger_hotkey"),
    actionId: z.string(),
    catalogId: z.string().optional(),
    catalogVersion: z.string().optional(),
    hotkeyId: z.string().optional(),
    cueLabels: z.array(vtsCueLabelIdSchema).min(1).optional(),
    intensity: z.number().optional(),
    confidence: z.number().min(0).max(1).optional(),
    visualEvidence: z.string().optional(),
    reason: z.string(),
    cooldownMs: z.number().optional(),
  })
  .strict()
  .refine((value) => typeof value.catalogId === "string" || typeof value.hotkeyId === "string" || Array.isArray(value.cueLabels), {
    message: "VTS hotkey actions must include cueLabels, catalogId, or hotkeyId.",
  })
  .refine((value) => !(typeof value.catalogId === "string" && typeof value.hotkeyId === "string"), {
    message: "VTS hotkey actions must not include both catalogId and hotkeyId.",
  });

export const setVtsParameterActionSchema = z.object({
  type: z.literal("vts.set_parameter"),
  actionId: z.string(),
  parameterId: z.string(),
  value: z.number(),
  weight: z.number().optional(),
  durationMs: z.number().optional(),
  reason: z.string(),
}).strict();

export const obsSceneActionSchema = z.object({
  type: z.literal("obs.set_scene"),
  actionId: z.string(),
  sceneName: z.string(),
  reason: z.string(),
}).strict();

export const obsSourceVisibilityActionSchema = z.object({
  type: z.literal("obs.set_source_visibility"),
  actionId: z.string(),
  sceneName: z.string(),
  sourceName: z.string(),
  visible: z.boolean(),
  reason: z.string(),
}).strict();

export const sendOverlayMessageActionSchema = z.object({
  type: z.literal("overlay.message"),
  actionId: z.string(),
  message: z.string(),
  displayDurationMs: z.number(),
  reason: z.string(),
}).strict();

export const logEventActionSchema = z.object({
  type: z.literal("log.event"),
  actionId: z.string(),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const noopActionSchema = z.object({
  type: z.literal("noop"),
  actionId: z.string(),
  reason: z.string(),
}).strict();

export const localActionSchema = z.discriminatedUnion("type", [
  triggerVtsHotkeyActionSchema,
  setVtsParameterActionSchema,
  obsSceneActionSchema,
  obsSourceVisibilityActionSchema,
  sendOverlayMessageActionSchema,
  logEventActionSchema,
  noopActionSchema,
]);

const actionsSchema = z.preprocess((value) => {
  if (Array.isArray(value) && value.length === 0) {
    return [
      {
        type: "noop",
        actionId: "act_empty_actions_noop",
        reason: "Model returned an empty actions array; normalized to explicit noop.",
      },
    ];
  }

  return value;
}, z.array(localActionSchema).min(1));

export const actionPlanSchema = z.object({
  schemaVersion: z.literal("2026-05-02"),
  tickId: z.string(),
  createdAt: z.string(),
  response: z
    .object({
      text: z.string().optional(),
      audioTranscript: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      visibleToUser: z.boolean(),
    })
    .optional(),
  actions: actionsSchema,
  safety: z.object({
    riskLevel: z.enum(["low", "medium", "high"]),
    requiresConfirmation: z.boolean(),
    reason: z.string().optional(),
  }),
  nextTick: z.object({
    suggestedDelayMs: z.number().transform((value) => Math.max(value, 500)),
    priority: z.enum(["low", "normal", "high"]),
  }),
  debug: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
    })
    .optional(),
});

export type ActionPlan = z.infer<typeof actionPlanSchema>;
export type LocalAction = z.infer<typeof localActionSchema>;
