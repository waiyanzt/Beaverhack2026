import { z } from "zod";

export const triggerVtsHotkeyActionSchema = z.object({
  type: z.literal("vts.trigger_hotkey"),
  actionId: z.string(),
  catalogId: z.string().optional(),
  catalogVersion: z.string().optional(),
  hotkeyId: z.string().optional(),
  intensity: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  visualEvidence: z.string().optional(),
  reason: z.string(),
  cooldownMs: z.number().optional(),
}).refine((value) => typeof value.catalogId === "string" || typeof value.hotkeyId === "string", {
  message: "VTS hotkey actions must include a catalogId or hotkeyId.",
});

export const setVtsParameterActionSchema = z.object({
  type: z.literal("vts.set_parameter"),
  actionId: z.string(),
  parameterId: z.string(),
  value: z.number(),
  weight: z.number().optional(),
  durationMs: z.number().optional(),
  reason: z.string(),
});

export const obsSceneActionSchema = z.object({
  type: z.literal("obs.set_scene"),
  actionId: z.string(),
  sceneName: z.string(),
  reason: z.string(),
});

export const obsSourceVisibilityActionSchema = z.object({
  type: z.literal("obs.set_source_visibility"),
  actionId: z.string(),
  sceneName: z.string(),
  sourceName: z.string(),
  visible: z.boolean(),
  reason: z.string(),
});

export const sendOverlayMessageActionSchema = z.object({
  type: z.literal("overlay.message"),
  actionId: z.string(),
  message: z.string(),
  displayDurationMs: z.number(),
  reason: z.string(),
});

export const logEventActionSchema = z.object({
  type: z.literal("log.event"),
  actionId: z.string(),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const noopActionSchema = z.object({
  type: z.literal("noop"),
  actionId: z.string(),
  reason: z.string(),
});

export const localActionSchema = z.discriminatedUnion("type", [
  triggerVtsHotkeyActionSchema,
  setVtsParameterActionSchema,
  obsSceneActionSchema,
  obsSourceVisibilityActionSchema,
  sendOverlayMessageActionSchema,
  logEventActionSchema,
  noopActionSchema,
]);

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
  actions: z.array(localActionSchema),
  safety: z.object({
    riskLevel: z.enum(["low", "medium", "high"]),
    requiresConfirmation: z.boolean(),
    reason: z.string().optional(),
  }),
  nextTick: z.object({
    suggestedDelayMs: z.number(),
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
