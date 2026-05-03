import { ObsService } from "../../src/main/services/obs/obs.service";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const obs = new ObsService();
  const [, , requestedSceneName, requestedSourceName] = process.argv;

  console.log("=== OBS AFK Overlay E2E Test ===\n");
  if (!requestedSourceName) {
    console.error("Usage: pnpm tsx tests/standalone/obs-vacancy-e2e.ts <scene-name> <source-name>");
    process.exit(1);
  }

  console.log("[1/6] Connecting to OBS...");
  await obs.connect("localhost", 4455);
  console.log("      Connected.\n");

  await sleep(500);

  console.log("[2/6] Reading current scene state...");
  const statusBefore = await obs.getStatus();
  if (!statusBefore.connected) {
    console.error("      FAILED: OBS reported not connected.");
    await obs.disconnect();
    process.exit(1);
  }
  console.log(`      Current scene: ${statusBefore.currentScene}`);
  console.log(`      Scenes: ${statusBefore.scenes.map((s) => s.name).join(", ")}`);

  const sceneName = requestedSceneName || statusBefore.currentScene;
  const scene = statusBefore.scenes.find((s) => s.name === sceneName);
  if (!scene) {
    console.error(`      FAILED: Could not find selected scene "${sceneName}" in scene list.`);
    await obs.disconnect();
    process.exit(1);
  }
  console.log(`      Sources in "${scene.name}": ${scene.sources.map((s) => `${s.name}(visible=${s.visible})`).join(", ")}`);

  const overlaySource = scene.sources.find((s) => s.name === requestedSourceName);
  if (!overlaySource) {
    console.error(`      FAILED: selected source "${requestedSourceName}" not found in selected scene.`);
    console.error(`      Available sources: ${scene.sources.map((s) => s.name).join(", ")}`);
    await obs.disconnect();
    process.exit(1);
  }
  console.log(`      Found "${requestedSourceName}" source. Current visibility: ${overlaySource.visible}\n`);

  console.log("[3/6] Showing selected AFK overlay source...");
  await obs.setSourceVisibility(scene.name, requestedSourceName, true);
  console.log("      Called setSourceVisibility(visible=true).\n");

  await sleep(500);

  console.log("[4/6] Verifying selected AFK overlay source is visible...");
  const statusAfterShow = await obs.getStatus();
  if (!statusAfterShow.connected) {
    console.error("      FAILED: OBS reported not connected after show.");
    await obs.disconnect();
    process.exit(1);
  }
  const sceneAfterShow = statusAfterShow.scenes.find((s) => s.name === scene.name);
  const overlayAfterShow = sceneAfterShow?.sources.find((s) => s.name === requestedSourceName);
  if (!overlayAfterShow) {
    console.error("      FAILED: selected AFK overlay source disappeared after show.");
    await obs.disconnect();
    process.exit(1);
  }
  if (overlayAfterShow.visible) {
    console.log("      PASS: selected AFK overlay source is now visible.\n");
  } else {
    console.error("      FAILED: selected AFK overlay source is still hidden after show command.");
    console.log(`      All sources: ${sceneAfterShow?.sources.map((s) => `${s.name}(visible=${s.visible})`).join(", ")}`);
    await obs.disconnect();
    process.exit(1);
  }

  console.log("[5/6] Hiding selected AFK overlay source...");
  await obs.setSourceVisibility(scene.name, requestedSourceName, false);
  console.log("      Called setSourceVisibility(visible=false).\n");

  await sleep(500);

  console.log("[6/6] Verifying selected AFK overlay source is hidden...");
  const statusAfterHide = await obs.getStatus();
  if (!statusAfterHide.connected) {
    console.error("      FAILED: OBS reported not connected after hide.");
    await obs.disconnect();
    process.exit(1);
  }
  const sceneAfterHide = statusAfterHide.scenes.find((s) => s.name === scene.name);
  const overlayAfterHide = sceneAfterHide?.sources.find((s) => s.name === requestedSourceName);
  if (!overlayAfterHide) {
    console.error("      FAILED: selected AFK overlay source disappeared after hide.");
    await obs.disconnect();
    process.exit(1);
  }
  if (!overlayAfterHide.visible) {
    console.log("      PASS: selected AFK overlay source is now hidden.\n");
  } else {
    console.error("      FAILED: selected AFK overlay source is still visible after hide command.");
    console.log(`      All sources: ${sceneAfterHide?.sources.map((s) => `${s.name}(visible=${s.visible})`).join(", ")}`);
    await obs.disconnect();
    process.exit(1);
  }

  await obs.disconnect();
  console.log("=== All E2E tests PASSED ===");
}

void main().catch((error) => {
  console.error("E2E test failed:", error);
  process.exit(1);
});
