import { z } from "zod";

export const automationAnalyzeNowRequestSchema = z
  .object({
    transcript: z.string().trim().min(1).optional(),
    dryRun: z.boolean().optional(),
    useLatestCapture: z.boolean().optional(),
    captureInputMode: z.enum(["latest_frame", "clip"]).optional(),
    captureWindowMs: z.number().int().min(250).max(60_000).optional(),
    includeSeparateAudio: z.boolean().optional(),
    allowObsActions: z.boolean().optional(),
    modelProviderId: z.enum(["openrouter", "vllm", "secondary", "mock"]).optional(),
    decisionRole: z.enum(["primary_emote", "secondary_director"]).optional(),
    vtsCandidateMode: z.enum(["safe_auto", "inferable"]).optional(),
  })
  .strict();

export type AutomationAnalyzeNowRequestSchema = z.infer<typeof automationAnalyzeNowRequestSchema>;
