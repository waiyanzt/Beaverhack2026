import { readFileSync } from "node:fs";
import { join } from "node:path";

export type PromptName = "system" | "action-planner";

export interface LoadedPrompt {
  name: PromptName;
  content: string;
}

const PROMPT_PATHS: Record<PromptName, string> = {
  system: join(__dirname, "../../../../models/prompts/system-prompt.md"),
  "action-planner": join(__dirname, "../../../../models/prompts/action-planner-prompt.md"),
};

export function loadPrompt(name: PromptName): LoadedPrompt {
  const content = readFileSync(PROMPT_PATHS[name], "utf8").trim();

  if (!content) {
    throw new Error(`Prompt content is empty: ${name}`);
  }

  return {
    name,
    content,
  };
}

export function loadAllPrompts(): LoadedPrompt[] {
  return [loadPrompt("system"), loadPrompt("action-planner")];
}
