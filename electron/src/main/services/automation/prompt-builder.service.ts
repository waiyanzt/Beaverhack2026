import type { OpenAICompatibleMessage } from "../../../shared/model.types";
import type { ModelControlContext } from "../../../shared/types/observation.types";
import { loadPrompt } from "../../prompts/prompt-loader";

export class PromptBuilderService {
  public buildMessages(modelContext: ModelControlContext): OpenAICompatibleMessage[] {
    const systemPrompt = `${loadPrompt("system").content}\n\n${loadPrompt("action-planner").content}`;

    return [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(modelContext, null, 2),
      },
    ];
  }
}
