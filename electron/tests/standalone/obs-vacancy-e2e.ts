import { ObsService } from "../../src/main/services/obs/obs.service";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const obs = new ObsService();

  console.log("=== OBS Vacancy Overlay E2E Test ===\n");

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

  const scene = statusBefore.scenes.find((s) => s.name === statusBefore.currentScene);
  if (!scene) {
    console.error("      FAILED: Could not find current scene in scene list.");
    await obs.disconnect();
    process.exit(1);
  }
  console.log(`      Sources in "${scene.name}": ${scene.sources.map((s) => `${s.name}(visible=${s.visible})`).join(", ")}`);

  const brbSource = scene.sources.find((s) => s.name === "BRB Overlay");
  if (!brbSource) {
    console.error("      FAILED: 'BRB Overlay' source not found in current scene.");
    console.error(`      Available sources: ${scene.sources.map((s) => s.name).join(", ")}`);
    await obs.disconnect();
    process.exit(1);
  }
  console.log(`      Found "BRB Overlay" source. Current visibility: ${brbSource.visible}\n`);

  console.log("[3/6] Showing BRB Overlay...");
  await obs.setSourceVisibility(scene.name, "BRB Overlay", true);
  console.log("      Called setSourceVisibility(visible=true).\n");

  await sleep(500);

  console.log("[4/6] Verifying BRB Overlay is visible...");
  const statusAfterShow = await obs.getStatus();
  if (!statusAfterShow.connected) {
    console.error("      FAILED: OBS reported not connected after show.");
    await obs.disconnect();
    process.exit(1);
  }
  const sceneAfterShow = statusAfterShow.scenes.find((s) => s.name === statusAfterShow.currentScene);
  const brbAfterShow = sceneAfterShow?.sources.find((s) => s.name === "BRB Overlay");
  if (!brbAfterShow) {
    console.error("      FAILED: BRB Overlay source disappeared after show.");
    await obs.disconnect();
    process.exit(1);
  }
  if (brbAfterShow.visible) {
    console.log("      PASS: BRB Overlay is now visible.\n");
  } else {
    console.error("      FAILED: BRB Overlay is still hidden after show command.");
    console.log(`      All sources: ${sceneAfterShow?.sources.map((s) => `${s.name}(visible=${s.visible})`).join(", ")}`);
    await obs.disconnect();
    process.exit(1);
  }

  console.log("[5/6] Hiding BRB Overlay...");
  await obs.setSourceVisibility(scene.name, "BRB Overlay", false);
  console.log("      Called setSourceVisibility(visible=false).\n");

  await sleep(500);

  console.log("[6/6] Verifying BRB Overlay is hidden...");
  const statusAfterHide = await obs.getStatus();
  if (!statusAfterHide.connected) {
    console.error("      FAILED: OBS reported not connected after hide.");
    await obs.disconnect();
    process.exit(1);
  }
  const sceneAfterHide = statusAfterHide.scenes.find((s) => s.name === statusAfterHide.currentScene);
  const brbAfterHide = sceneAfterHide?.sources.find((s) => s.name === "BRB Overlay");
  if (!brbAfterHide) {
    console.error("      FAILED: BRB Overlay source disappeared after hide.");
    await obs.disconnect();
    process.exit(1);
  }
  if (!brbAfterHide.visible) {
    console.log("      PASS: BRB Overlay is now hidden.\n");
  } else {
    console.error("      FAILED: BRB Overlay is still visible after hide command.");
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
