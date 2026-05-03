import { z } from "zod";
import { vtsConnectionConfigSchema } from "./config.schema";

export const vtsHotkeySchema = z
  .object({
    hotkeyID: z.string().min(1),
    name: z.string(),
    type: z.string().min(1),
    description: z.string().nullable().optional(),
    file: z.string().nullable().optional(),
    keyCombination: z.array(z.unknown()).optional(),
    onScreenButtonID: z.number().int().optional(),
  })
  .passthrough();

export const vtsConnectRequestSchema = vtsConnectionConfigSchema;

export const vtsTriggerHotkeyRequestSchema = z
  .object({
    hotkeyId: z.string().trim().min(1),
  })
  .strict();
