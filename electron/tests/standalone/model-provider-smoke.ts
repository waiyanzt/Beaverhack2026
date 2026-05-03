import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAICompatibleProvider } from "../../src/main/services/model/openai-compatible.provider";
import type { ModelProviderConfig, OpenAICompatibleMessage } from "../../src/shared/model.types";
import { loadPrompt } from "../../src/main/prompts/prompt-loader";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, "../../../");
const localVideoPath = path.resolve(repoRoot, "samples/camera-capture-1777772334424.mp4");

async function main(): Promise<void> {
  const config: ModelProviderConfig = {
    id: "vllm",
    label: "vLLM (Nemotron)",
    baseUrl: "http://100.93.134.64:8000",
    model: "/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120",
    apiKey: null,
    enabled: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
    supportsForcedToolChoice: true,
    supportsStrictJsonSchema: true,
    maxTokens: 25600,
    temperature: 0.6,
    topP: 0.95,
    vllm: {
      thinkingTokenBudget: 16384,
      thinkingGracePeriod: 1024,
      enableThinking: true,
      useAudioInVideo: false,
    },
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

  const systemPrompt =
    loadPrompt("system").content + "\n\n" + loadPrompt("action-planner").content;

  console.log("Sending structured observation to", config.baseUrl);
  console.log("Model:", config.model);
  console.log("---");

  const results: Array<{ label: string; ok: boolean }> = [];

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

  results.push({ label: "Scenario 1", ok: result1.ok });
  console.log("\n========================================\n");

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

  results.push({ label: "Scenario 2", ok: result2.ok });
  console.log("\n========================================\n");

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

  results.push({ label: "Scenario 3", ok: result3.ok });
  console.log("\n========================================\n");

  const videoFileExists = existsSync(localVideoPath);

  if (videoFileExists) {
    const videoBuffer = readFileSync(localVideoPath);
    const videoBase64 = videoBuffer.toString("base64");
    const videoMimeType = localVideoPath.endsWith(".webm") ? "video/webm" : "video/mp4";
    const videoDataUrl = `data:${videoMimeType};base64,${videoBase64}`;

    console.log("Scenario 4: Video observation");
    console.log("Video size:", (videoBuffer.length / 1024 / 1024).toFixed(2), "MB");
    console.log("Data URI length:", (videoDataUrl.length / 1024 / 1024).toFixed(2), "MB");
    console.log("---");

    const videoObservation = {
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
        transcript: "",
        timestamp: new Date().toISOString(),
      },
      context: {
        autonomyLevel: "auto_safe",
        recentActions: [],
        cooldowns: {},
      },
    };

    const userContent: OpenAICompatibleMessage["content"] = [
      { type: "video_url", video_url: { url: videoDataUrl } },
      {
        type: "text",
        text:
          "The above is a short webcam video from a VTuber stream. Focus on the person's expression, gaze, posture, and whether they seem neutral, happy, tired, surprised, or otherwise emotionally engaged. If the clip does not clearly justify a reaction, return noop. Avoid verbose explanations. Observation data:\n" +
          JSON.stringify(videoObservation),
      },
    ];

    const result4 = await provider.createActionPlan(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ]);

    console.log("Status:", result4.status);
    console.log("OK:", result4.ok);

    if (result4.actionPlan) {
      console.log("✅ Structured ActionPlan:");
      console.log(JSON.stringify(result4.actionPlan, null, 2));
    } else {
      console.log("❌ No structured action plan. Raw content:");
      console.log(result4.content);
    }

    results.push({ label: "Scenario 4 (video)", ok: result4.ok });
  } else {
    console.log("Scenario 4: Video file not found locally, skipping.");
    console.log("Expected:", localVideoPath);
  }

  console.log("\n========================================\n");

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error("❌ Failed scenarios:", failed.map((r) => r.label).join(", "));
    process.exit(1);
  }

  console.log("✅ All smoke tests passed!");
}

void main();