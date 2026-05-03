import { z } from "zod";
import { captureStartRequestSchema } from "./capture.schema";
import { MODEL_MONITOR_VALIDATION_LIMITS } from "../model-monitor.defaults";

export const modelMonitorStartRequestSchema = z
  .object({
    capture: captureStartRequestSchema,
    tickIntervalMs: z
      .number()
      .int()
      .min(MODEL_MONITOR_VALIDATION_LIMITS.minTickIntervalMs)
      .max(MODEL_MONITOR_VALIDATION_LIMITS.maxTickIntervalMs),
    windowMs: z
      .number()
      .int()
      .min(MODEL_MONITOR_VALIDATION_LIMITS.minWindowMs)
      .max(MODEL_MONITOR_VALIDATION_LIMITS.maxWindowMs),
    secondaryMode: z.enum(["off", "auto_unsupported", "forced"]).default("auto_unsupported"),
  })
  .strict();

export type ModelMonitorStartRequestSchema = z.infer<typeof modelMonitorStartRequestSchema>;
