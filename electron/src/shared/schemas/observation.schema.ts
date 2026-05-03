import { z } from "zod";

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

export const modelControlVtsStateSchema = z
  .object({
    connected: z.boolean(),
    authenticated: z.boolean(),
    currentModelName: z.string().nullable(),
    availableHotkeys: z.array(modelControlVtsHotkeySchema),
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
    timestamp: z.string().datetime(),
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
        cooldowns: z.record(z.string(), z.number().int().nonnegative()),
      })
      .strict(),
  })
  .strict();

export type ModelControlContextSchema = z.infer<typeof modelControlContextSchema>;
