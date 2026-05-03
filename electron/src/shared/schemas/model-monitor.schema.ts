import { z } from "zod";
import { captureStartRequestSchema } from "./capture.schema";

export const modelMonitorStartRequestSchema = z
  .object({
    capture: captureStartRequestSchema,
    tickIntervalMs: z.number().int().min(250).max(60_000),
    windowMs: z.number().int().min(1_000).max(120_000),
  })
  .strict();

export type ModelMonitorStartRequestSchema = z.infer<typeof modelMonitorStartRequestSchema>;
