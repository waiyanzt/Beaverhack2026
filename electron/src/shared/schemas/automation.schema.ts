import { z } from "zod";

export const automationAnalyzeNowRequestSchema = z
  .object({
    transcript: z.string().trim().min(1).optional(),
    dryRun: z.boolean().optional(),
    useLatestCapture: z.boolean().optional(),
    captureWindowMs: z.number().int().min(250).max(60_000).optional(),
    allowObsActions: z.boolean().optional(),
  })
  .strict();

export type AutomationAnalyzeNowRequestSchema = z.infer<typeof automationAnalyzeNowRequestSchema>;
