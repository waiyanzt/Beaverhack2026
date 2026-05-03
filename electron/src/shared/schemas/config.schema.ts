import { z } from "zod";

export const vtsConnectionConfigSchema = z
  .object({
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535),
    pluginName: z.string().trim().min(3).max(32),
    pluginDeveloper: z.string().trim().min(3).max(32),
  })
  .strict();

export const appConfigSchema = z
  .object({
    vts: vtsConnectionConfigSchema,
  })
  .strict();

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
