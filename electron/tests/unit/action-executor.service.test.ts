import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionExecutorService } from "../../src/main/services/automation/action-executor.service";
import { CooldownService } from "../../src/main/services/automation/cooldown.service";
import type { ReviewedAction } from "../../src/shared/types/action-plan.types";

describe("ActionExecutorService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-triggers VTS hotkeys that do not auto-deactivate", async () => {
    vi.useFakeTimers();

    const triggerHotkey = vi.fn().mockResolvedValue("wave");
    const executor = new ActionExecutorService(
      {
        setCurrentScene: vi.fn(),
        setSourceVisibility: vi.fn(),
      },
      {
        triggerHotkey,
        resolveCatalogEntry: vi.fn().mockReturnValue({
          catalogId: "wave",
          hotkeyId: "wave-hotkey",
          hasAutoDeactivate: false,
          manualDeactivateAfterMs: 2500,
        }),
      },
      new CooldownService(() => Date.now()),
    );

    const reviewedAction: ReviewedAction = {
      status: "approved",
      reason: "approved",
      action: {
        type: "vts.trigger_hotkey",
        actionId: "action_1",
        reason: "Wave at chat.",
        catalogId: "wave",
      },
    };

    await executor.execute([reviewedAction]);
    expect(triggerHotkey).toHaveBeenCalledTimes(1);
    expect(triggerHotkey).toHaveBeenNthCalledWith(1, "wave-hotkey");

    await vi.advanceTimersByTimeAsync(2500);
    expect(triggerHotkey).toHaveBeenCalledTimes(2);
    expect(triggerHotkey).toHaveBeenNthCalledWith(2, "wave-hotkey");
  });

  it("does not re-trigger VTS hotkeys that auto-deactivate on their own", async () => {
    vi.useFakeTimers();

    const triggerHotkey = vi.fn().mockResolvedValue("laugh");
    const executor = new ActionExecutorService(
      {
        setCurrentScene: vi.fn(),
        setSourceVisibility: vi.fn(),
      },
      {
        triggerHotkey,
        resolveCatalogEntry: vi.fn().mockReturnValue({
          catalogId: "laugh",
          hotkeyId: "laugh-hotkey",
          hasAutoDeactivate: true,
          manualDeactivateAfterMs: 2500,
        }),
      },
      new CooldownService(() => Date.now()),
    );

    const reviewedAction: ReviewedAction = {
      status: "approved",
      reason: "approved",
      action: {
        type: "vts.trigger_hotkey",
        actionId: "action_2",
        reason: "Laugh reaction.",
        catalogId: "laugh",
      },
    };

    await executor.execute([reviewedAction]);
    await vi.advanceTimersByTimeAsync(5000);

    expect(triggerHotkey).toHaveBeenCalledTimes(1);
    expect(triggerHotkey).toHaveBeenCalledWith("laugh-hotkey");
  });
});
