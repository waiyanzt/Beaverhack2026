import { describe, expect, it } from "vitest";
import {
  createModelMonitorCaptureConfig,
  MODEL_MONITOR_DEFAULT_TIMING,
} from "../../src/shared/model-monitor.defaults";
import { modelMonitorStartRequestSchema } from "../../src/shared/schemas/model-monitor.schema";

describe("model monitor defaults", () => {
  it("produce a valid start request", () => {
    const result = modelMonitorStartRequestSchema.safeParse({
      tickIntervalMs: MODEL_MONITOR_DEFAULT_TIMING.tickIntervalMs,
      windowMs: MODEL_MONITOR_DEFAULT_TIMING.windowMs,
      capture: createModelMonitorCaptureConfig({
        audioDeviceId: "audio-device",
        videoDeviceId: "video-device",
      }),
    });

    expect(result.success).toBe(true);
  });

  it("uses overlapping rolling clip windows for the dashboard monitor", () => {
    const capture = createModelMonitorCaptureConfig({});
    const expectedIntervalSeconds = MODEL_MONITOR_DEFAULT_TIMING.clipIntervalMs / 1000;

    expect(capture.camera.clipDurationSeconds * 1000).toBe(MODEL_MONITOR_DEFAULT_TIMING.windowMs);
    expect(capture.camera.clipIntervalSeconds).toBe(expectedIntervalSeconds);
    expect(capture.audio.bufferDurationSeconds * 1000).toBe(MODEL_MONITOR_DEFAULT_TIMING.windowMs);
    expect(capture.audio.clipIntervalSeconds).toBe(expectedIntervalSeconds);
  });

  it("caps overlapping model dispatches to avoid stale provider queues", () => {
    expect(MODEL_MONITOR_DEFAULT_TIMING.maxInFlightRequests).toBeGreaterThan(0);
    expect(MODEL_MONITOR_DEFAULT_TIMING.maxInFlightRequests).toBeLessThanOrEqual(2);
  });
});
