import "dotenv/config";
import { OpenAICompatibleProvider } from "../../src/main/services/model/openai-compatible.provider";
import type { ModelProviderConfig } from "../../src/shared/model.types";

async function main(): Promise<void> {
  // vLLM requires no API key; OpenRouter tests would need OPENROUTER_API_KEY
  const apiKey = process.env.OPENROUTER_API_KEY ?? null;

  const config: ModelProviderConfig = {
    id: "vllm",
    label: "vLLM (Nemotron)",
    baseUrl: "http://127.0.0.1:8000",
    model: "/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120",
    apiKey: null,
    enabled: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
    supportsForcedToolChoice: true,
    supportsStrictJsonSchema: true,
    maxTokens: 25600,
  };

  const provider = new OpenAICompatibleProvider({
    postJson: async (url, body, headers) => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const responseBody = await response.text();

      return {
        status: response.status,
        body: responseBody,
      };
    },
  });

  console.log("Sending structured observation to", config.baseUrl);
  console.log("Model:", config.model);
  console.log("---");

  const responseMode = config.supportsToolCalling ? "tool" : "json";

  const systemPrompt = `You are Beaverhack2026, a VTuber stream-direction agent running inside a local desktop app.

You receive structured observations from local capture, OBS, and VTube Studio. You do not directly control the stream. You produce a structured ActionPlan. The desktop app validates and executes only allowed actions.

Goals:
1. Understand streamer context from transcript, frames, OBS state, and VTube Studio state.
2. Select useful avatar reactions, overlay messages, or stream-control suggestions.
3. Avoid over-triggering actions.
4. Respect cooldowns, allowlists, blocked actions, and autonomy level.
5. Prefer subtle useful reactions over noisy behavior.
6. If no action is needed, return a noop action.

Rules:
${responseMode === "tool" ? `- You MUST use the create_action_plan tool to respond.` : `- You MUST respond with a single JSON object matching the ActionPlan schema. Do not wrap it in markdown code blocks. Do not include any text outside the JSON object.`}
- When triggering VTS hotkeys, use the semantic name (e.g., "wave", "laugh", "surprise"). The app maps these to actual hotkey IDs.
- Return only valid structured actions.
- Do not request actions outside the allowed action list.
- Do not trigger the same hotkey repeatedly without a clear reason.
- Do not switch OBS scenes unless policy allows it.
- Keep visible messages short.
- Include a short reason for every action.
- Always set schemaVersion to "2026-05-02".
- Generate a unique tickId and createdAt timestamp.
- It is VERY COMMON and EXPECTED to return noop when no action is appropriate. Do not force actions.`;

  // Scenario 1: Streamer just started, greeting audience
  const observation1 = {
    observation: {
      obs: {
        connected: true,
        currentScene: "Intro",
        streaming: true,
        recording: false,
        sources: [
          { name: "Webcam", visible: true },
          { name: "Gameplay", visible: false },
        ],
      },
      vts: {
        connected: true,
        authenticated: true,
        modelLoaded: true,
        availableHotkeys: [
          { id: "wave", name: "Wave" },
          { id: "laugh", name: "Laugh" },
          { id: "surprise", name: "Surprise" },
          { id: "heart", name: "Heart Eyes" },
          { id: "angry", name: "Angry" },
        ],
      },
      transcript: "Hey everyone! Welcome back! I missed you all so much. We're gonna have an amazing stream today!",
      timestamp: new Date().toISOString(),
    },
    context: {
      autonomyLevel: "auto_safe",
      recentActions: [],
      cooldowns: {},
    },
  };

  console.log("Scenario 1: Enthusiastic greeting");
  console.log("---");

  const result1 = await provider.createActionPlan(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: JSON.stringify(observation1) },
  ]);

  console.log("Status:", result1.status);
  console.log("OK:", result1.ok);

  if (result1.actionPlan) {
    console.log("✅ Structured ActionPlan:");
    console.log(JSON.stringify(result1.actionPlan, null, 2));
  } else {
    console.log("❌ No structured action plan. Raw content:");
    console.log(result1.content);
  }

  console.log("\n========================================\n");

  // Scenario 2: Streamer is talking normally, no special event
  const observation2 = {
    observation: {
      obs: {
        connected: true,
        currentScene: "Gameplay",
        streaming: true,
        recording: false,
        sources: [
          { name: "Webcam", visible: true },
          { name: "Gameplay", visible: true },
        ],
      },
      vts: {
        connected: true,
        authenticated: true,
        modelLoaded: true,
        availableHotkeys: [
          { id: "wave", name: "Wave" },
          { id: "laugh", name: "Laugh" },
          { id: "surprise", name: "Surprise" },
        ],
      },
      transcript: "So yeah, I'm just grinding this level right now. Nothing too exciting happening.",
      timestamp: new Date().toISOString(),
    },
    context: {
      autonomyLevel: "auto_safe",
      recentActions: [
        { type: "vts.trigger_hotkey", hotkeyId: "wave", timestamp: Date.now() - 3000 },
      ],
      cooldowns: {
        wave: 5000,
      },
    },
  };

  console.log("Scenario 2: Casual gameplay, no special event");
  console.log("---");

  const result2 = await provider.createActionPlan(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: JSON.stringify(observation2) },
  ]);

  console.log("Status:", result2.status);
  console.log("OK:", result2.ok);

  if (result2.actionPlan) {
    console.log("✅ Structured ActionPlan:");
    console.log(JSON.stringify(result2.actionPlan, null, 2));
  } else {
    console.log("❌ No structured action plan. Raw content:");
    console.log(result2.content);
  }

  console.log("\n========================================\n");

  // Scenario 3: Streamer hits something surprising
  const observation3 = {
    observation: {
      obs: {
        connected: true,
        currentScene: "Gameplay",
        streaming: true,
        recording: true,
        sources: [
          { name: "Webcam", visible: true },
          { name: "Gameplay", visible: true },
        ],
      },
      vts: {
        connected: true,
        authenticated: true,
        modelLoaded: true,
        availableHotkeys: [
          { id: "wave", name: "Wave" },
          { id: "laugh", name: "Laugh" },
          { id: "surprise", name: "Surprise" },
          { id: "heart", name: "Heart Eyes" },
        ],
      },
      transcript: "OH MY GOD! DID YOU SEE THAT?! That was INSANE! I can't believe that just happened!",
      timestamp: new Date().toISOString(),
    },
    context: {
      autonomyLevel: "auto_safe",
      recentActions: [],
      cooldowns: {},
    },
  };

  console.log("Scenario 3: Exciting moment");
  console.log("---");

  const result3 = await provider.createActionPlan(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: JSON.stringify(observation3) },
  ]);

  console.log("Status:", result3.status);
  console.log("OK:", result3.ok);

  if (result3.actionPlan) {
    console.log("✅ Structured ActionPlan:");
    console.log(JSON.stringify(result3.actionPlan, null, 2));
  } else {
    console.log("❌ No structured action plan. Raw content:");
    console.log(result3.content);
  }

  console.log("\n========================================\n");

  if (!result1.ok || !result2.ok || !result3.ok) {
    console.error("❌ One or more provider calls failed.");
    process.exit(1);
  }

  console.log("✅ All smoke tests passed!");
}

void main();
