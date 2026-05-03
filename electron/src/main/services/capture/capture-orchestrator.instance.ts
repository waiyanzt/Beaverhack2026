import { CaptureOrchestratorService } from "./capture-orchestrator.service";
import { createHiddenCaptureWindow } from "../../windows/hidden-capture-window";

export const captureOrchestrator = new CaptureOrchestratorService({
  createHiddenWindow: createHiddenCaptureWindow,
});

let selectedScreenSourceId: string | null = null;

export function setSelectedScreenSourceId(sourceId: string | null): void {
  selectedScreenSourceId = sourceId;
}

export function getSelectedScreenSourceId(): string | null {
  return selectedScreenSourceId;
}
