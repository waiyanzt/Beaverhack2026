import type { OpenAICompatibleMessage } from "../../../shared/model.types";
import type { ModelControlContext } from "../../../shared/types/observation.types";
import { loadPrompt } from "../../prompts/prompt-loader";

export class PromptBuilderService {
  public buildMessages(modelContext: ModelControlContext): OpenAICompatibleMessage[] {
    const systemPrompt = `${loadPrompt("system").content}\n\n${loadPrompt("action-planner").content}`;
    const promptPayload = {
      instructions: [
        "Here are the current stream controls, observation context, cooldowns, and recent model action plans.",
        "Use recentModelActions as short-term memory for continuity. Take the prior full ActionPlan JSON, action reasons, safety assessment, and execution results into account before choosing the next action.",
        "Avoid repeating an action just because it appears in memory; repeat only when the current observation clearly supports continuing that reaction or behavior.",
      ],
      modelContext,
    };

    return [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(promptPayload, null, 2),
      },
    ];
  }
}
