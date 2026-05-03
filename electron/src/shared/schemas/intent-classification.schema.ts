import { z } from "zod";

export const intentClassificationSchema = z.object({
  intent: z.string().describe("The matching intent label from the catalog"),
  confidence: z.number().min(0).max(1).describe("Confidence from 0 to 1"),
  description: z.string().describe("Brief description of what is visible in the frames"),
});

export type IntentClassification = z.infer<typeof intentClassificationSchema>;
