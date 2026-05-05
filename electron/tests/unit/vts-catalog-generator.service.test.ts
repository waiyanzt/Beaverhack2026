import { describe, expect, it, vi } from "vitest";
import { VtsCatalogGeneratorService } from "../../src/main/services/vts/vts-catalog-generator.service";
import type { ModelRouterService } from "../../src/main/services/model/model-router.service";
import type { VtsHotkey } from "../../src/shared/types/vts.types";
import { DEFAULT_VTS_CUE_LABELS } from "../../src/shared/vts-cue-labels";

const hotkeys: VtsHotkey[] = [
  {
    hotkeyID: "heart",
    name: "Heart Eyes",
    type: "TriggerAnimation",
    description: null,
    file: null,
  },
  {
    hotkeyID: "shock",
    name: "Shock Sign",
    type: "TriggerAnimation",
    description: null,
    file: null,
  },
];

describe("VtsCatalogGeneratorService", () => {
  it("falls back to heuristics when classifier output is truncated", async () => {
    const modelRouter = {
      requestChat: vi.fn().mockResolvedValue({
        providerId: "vllm",
        ok: true,
        status: 200,
        content: "{\"items\":[",
        finishReason: "length",
      }),
    } satisfies Pick<ModelRouterService, "requestChat">;
    const service = new VtsCatalogGeneratorService(modelRouter);

    const result = await service.generate(hotkeys, DEFAULT_VTS_CUE_LABELS);

    expect(result.heart?.source).toBe("heuristic");
    expect(result.shock?.source).toBe("heuristic");
  });

  it("falls back to heuristics when classifier item count does not match input hotkeys", async () => {
    const modelRouter = {
      requestChat: vi.fn().mockResolvedValue({
        providerId: "vllm",
        ok: true,
        status: 200,
        content: JSON.stringify({
          items: [
            {
              id: "heart",
              cueLabels: ["love_reaction"],
              emoteKind: "symbol_effect",
              autoMode: "safe_auto",
              confidence: 0.99,
            },
          ],
        }),
        finishReason: "stop",
      }),
    } satisfies Pick<ModelRouterService, "requestChat">;
    const service = new VtsCatalogGeneratorService(modelRouter);

    const result = await service.generate(hotkeys, DEFAULT_VTS_CUE_LABELS);

    expect(result.heart?.source).toBe("heuristic");
    expect(result.shock?.source).toBe("heuristic");
  });

  it("demotes model-generated love reactions out of safe auto", async () => {
    const modelRouter = {
      requestChat: vi.fn().mockResolvedValue({
        providerId: "vllm",
        ok: true,
        status: 200,
        content: JSON.stringify({
          items: [
            {
              id: "heart",
              cueLabels: ["love_reaction"],
              emoteKind: "symbol_effect",
              autoMode: "safe_auto",
              confidence: 0.99,
            },
            {
              id: "shock",
              cueLabels: ["shocked", "surprised"],
              emoteKind: "symbol_effect",
              autoMode: "safe_auto",
              confidence: 0.99,
            },
          ],
        }),
        finishReason: "stop",
      }),
    } satisfies Pick<ModelRouterService, "requestChat">;
    const service = new VtsCatalogGeneratorService(modelRouter);

    const result = await service.generate(hotkeys, DEFAULT_VTS_CUE_LABELS);

    expect(result.heart).toMatchObject({
      source: "model",
      autoMode: "suggest_only",
    });
    expect(result.shock).toMatchObject({
      source: "model",
      autoMode: "safe_auto",
    });
  });
});
