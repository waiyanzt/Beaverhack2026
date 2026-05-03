import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type PromptName = "system" | "action-planner" | "intent-system" | "intent-planner";

export interface LoadedPrompt {
  name: PromptName;
  content: string;
}

const PROMPT_FILES: Record<PromptName, string> = {
  system: "system-prompt.md",
  "action-planner": "action-planner-prompt.md",
  "intent-system": "intent-classifier-system.md",
  "intent-planner": "intent-classifier-planner.md",
};

function resolvePromptPath(name: PromptName): string {
  const fileName = PROMPT_FILES[name];
  const candidates = [
    resolve(process.cwd(), "../models/prompts", fileName),
    resolve(process.cwd(), "models/prompts", fileName),
    resolve(__dirname, "../../../../models/prompts", fileName),
    resolve(__dirname, "../../../models/prompts", fileName),
  ];

  const promptPath = candidates.find((candidate) => existsSync(candidate));

  if (!promptPath) {
    throw new Error(`Prompt file not found for ${name}. Checked: ${candidates.join(", ")}`);
  }

  return promptPath;
}

export function loadPrompt(name: PromptName): LoadedPrompt {
  const content = readFileSync(resolvePromptPath(name), "utf8").trim();

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
