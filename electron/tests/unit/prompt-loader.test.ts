import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAllPrompts, loadPrompt } from "../../src/main/prompts/prompt-loader";

describe("prompt-loader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the system prompt", () => {
    const prompt = loadPrompt("system");

    expect(prompt.name).toBe("system");
    expect(prompt.content).toContain("AuTuber's model coordinator");
    expect(prompt.content).toContain("stream-direction agent");
    expect(prompt.content.length).toBeGreaterThan(100);
  });

  it("loads the action-planner prompt", () => {
    const prompt = loadPrompt("action-planner");

    expect(prompt.name).toBe("action-planner");
    expect(prompt.content).toContain("action plan");
    expect(prompt.content).toContain("noop");
    expect(prompt.content.length).toBeGreaterThan(100);
  });

  it("loads all prompts", () => {
    const prompts = loadAllPrompts();

    expect(prompts).toHaveLength(2);
    expect(prompts.map((prompt) => prompt.name)).toEqual(["system", "action-planner"]);
  });
});
