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

export const vtsCatalogRefreshRequestSchema = z
  .object({
    forceRegenerate: z.boolean().optional(),
  })
  .strict();

export const vtsCatalogOverrideSchema = z
  .object({
    cueLabels: z.array(z.enum([
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
    ])).min(1),
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
    confidence: z.number().min(0).max(1),
    hasAutoDeactivate: z.boolean(),
    manualDeactivateAfterMs: z.number().int().min(500).max(300000),
  })
  .strict();

export const vtsCatalogOverrideUpdateRequestSchema = z
  .object({
    hotkeyId: z.string().trim().min(1),
    override: vtsCatalogOverrideSchema.nullable(),
  })
  .strict();
