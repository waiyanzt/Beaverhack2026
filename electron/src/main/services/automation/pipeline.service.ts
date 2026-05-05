import type { AutomationAnalyzeNowRequest, AutomationAnalyzeNowResult } from "../../../shared/types/action-plan.types";
import type { LocalAction } from "../../../shared/schemas/action-plan.schema";
import type {
  ModelControlContext,
  ModelControlRecentAction,
  ModelControlRecentActionSummary,
  ModelControlRecentModelAction,
} from "../../../shared/types/observation.types";
import type { VtsCueLabel } from "../../../shared/types/vts.types";
import { createId } from "../../utils/ids";
import type { ModelRouterService } from "../model/model-router.service";
import { ActionExecutorService } from "./action-executor.service";
import { ActionPlanParserService } from "./action-plan-parser.service";
import { ActionValidatorService } from "./action-validator.service";
import { AfkOverlayService } from "./afk-overlay.service";
import { CooldownService } from "./cooldown.service";
import { LiveCaptureInputService } from "./live-capture-input.service";
import { ModelActionMemoryService } from "./model-action-memory.service";
import { ObservationBuilderService } from "./observation-builder.service";
import { PromptBuilderService } from "./prompt-builder.service";

export class PipelineService {
  public constructor(
    private readonly observationBuilder: ObservationBuilderService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly modelRouter: Pick<ModelRouterService, "requestActionPlan">,
    private readonly actionPlanParser: ActionPlanParserService,
    private readonly actionValidator: ActionValidatorService,
    private readonly actionExecutor: ActionExecutorService,
    private readonly cooldownService: CooldownService,
    private readonly liveCaptureInputService: LiveCaptureInputService,
    private readonly modelActionMemoryService: ModelActionMemoryService,
    private readonly afkOverlayService: AfkOverlayService = new AfkOverlayService(),
  ) {}

  public async analyzeNow(request: AutomationAnalyzeNowRequest = {}): Promise<AutomationAnalyzeNowResult> {
    try {
      const pipelineStartedMs = Date.now();
      const baseModelContext = await this.observationBuilder.buildModelContext({
        tickId: createId("tick"),
        transcript: request.transcript,
        allowObsActions: request.allowObsActions ?? true,
        includeObsScenes: request.includeObsScenes ?? false,
        recentModelActions: this.modelActionMemoryService.getRecentModelActions(),
      });
      const observationBuiltMs = Date.now();
      const executionModelContext = request.useLatestCapture
        ? this.buildLivePromptContext(baseModelContext)
        : baseModelContext;
      const promptModelContext = request.useLatestCapture
        ? this.buildCueLabelOnlyPromptContext(executionModelContext)
        : executionModelContext;
      const liveCaptureInput = request.useLatestCapture
        ? await this.liveCaptureInputService.buildPromptInput(
            request.captureWindowMs ?? 1_000,
            request.captureInputMode ?? "clip",
            this.getMappedSafeAutoCueLabels(executionModelContext),
          )
        : undefined;
      const captureInputBuiltMs = Date.now();
      const prompt = this.promptBuilder.buildMessages(promptModelContext, liveCaptureInput);
      const promptBuiltMs = Date.now();
      const modelRequestStartedMs = Date.now();
      const modelResult = await this.modelRouter.requestActionPlan(prompt.messages);
      const modelResponseReceivedMs = Date.now();

      if (!modelResult.ok || !modelResult.actionPlan) {
        throw new Error(modelResult.content || "Model provider did not return an action plan.");
      }

      const rawPlan = this.actionPlanParser.parse(modelResult.actionPlan);
      const parsedPlan = this.resolveCueLabelActions(rawPlan, executionModelContext);
      const afkOverlayTransitionActions = this.afkOverlayService.reviewTransitions(
        rawPlan,
        executionModelContext,
        request.dryRun ?? false,
      );
      const reviewableActions = parsedPlan.actions.filter((action) => !this.isVacantCueAction(action));
      const reviewedActions = this.actionValidator.reviewActions(
        reviewableActions,
        executionModelContext,
        parsedPlan.safety.requiresConfirmation,
      );
      const allActions = [...reviewedActions, ...afkOverlayTransitionActions];
      const actionResults = await this.actionExecutor.execute(allActions, request.dryRun ?? false);
      this.modelActionMemoryService.record(parsedPlan, actionResults);
      const pipelineCompletedMs = Date.now();

      return {
        ok: true,
        modelContext: {
          ...executionModelContext,
          context: {
            ...executionModelContext.context,
            recentActions: this.cooldownService.getRecentActions(),
            recentModelActions: this.modelActionMemoryService.getRecentModelActions(),
            recentActionSummary: this.buildRecentActionSummary(this.modelActionMemoryService.getRecentModelActions()),
            cooldowns: this.cooldownService.getRemainingCooldowns(),
            cooldownSummary: this.buildCooldownSummary(this.cooldownService.getRemainingCooldowns()),
          },
        },
        plan: parsedPlan,
        reviewedActions: allActions,
        actionResults,
        requestDebug: {
          providerId: modelResult.providerId,
          statusCode: modelResult.status,
          promptTokens: modelResult.usage?.promptTokens ?? null,
          completionTokens: modelResult.usage?.completionTokens ?? null,
          totalTokens: modelResult.usage?.totalTokens ?? null,
          pipelineStartedAt: new Date(pipelineStartedMs).toISOString(),
          modelRequestStartedAt: new Date(modelRequestStartedMs).toISOString(),
          modelResponseReceivedAt: new Date(modelResponseReceivedMs).toISOString(),
          observationLatencyMs: Math.max(observationBuiltMs - pipelineStartedMs, 0),
          captureInputLatencyMs: Math.max(captureInputBuiltMs - observationBuiltMs, 0),
          promptBuildLatencyMs: Math.max(promptBuiltMs - captureInputBuiltMs, 0),
          modelRequestLatencyMs: Math.max(modelResponseReceivedMs - modelRequestStartedMs, 0),
          parseValidateExecuteLatencyMs: Math.max(pipelineCompletedMs - modelResponseReceivedMs, 0),
          pipelineLatencyMs: Math.max(pipelineCompletedMs - pipelineStartedMs, 0),
          promptTextBytes: prompt.requestDebug.promptTextBytes,
          mediaDataUrlBytes: prompt.requestDebug.mediaDataUrlBytes,
          requestContentBytes: prompt.requestDebug.promptTextBytes + prompt.requestDebug.mediaDataUrlBytes,
          sourceWindowKey: prompt.requestDebug.sourceWindowKey,
          sourceClipCount: prompt.requestDebug.sourceClipCount,
          modelMediaSha256: prompt.requestDebug.modelMediaSha256,
          modelMediaDataUrl: prompt.requestDebug.modelMediaDataUrl,
          mediaStartedAt: prompt.requestDebug.mediaStartMs
            ? new Date(prompt.requestDebug.mediaStartMs).toISOString()
            : null,
          mediaEndedAt: prompt.requestDebug.mediaEndMs
            ? new Date(prompt.requestDebug.mediaEndMs).toISOString()
            : null,
        },
      };
    } catch (error: unknown) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Automation pipeline failed.",
      };
    }
  }

  private buildLivePromptContext(modelContext: ModelControlContext): ModelControlContext {
    return {
      ...modelContext,
      context: {
        ...modelContext.context,
        recentActions: this.filterLiveRecentActions(modelContext.context.recentActions),
        recentModelActions: [],
        recentActionSummary: modelContext.context.recentActionSummary.slice(0, 3),
      },
    };
  }

  private buildCueLabelOnlyPromptContext(modelContext: ModelControlContext): ModelControlContext {
    return {
      ...modelContext,
      services: {
        ...modelContext.services,
        vts: {
          ...modelContext.services.vts,
          availableHotkeys: [],
          automationCatalog: {
            ...modelContext.services.vts.automationCatalog,
            candidates: [],
          },
        },
        obs: {
          ...modelContext.services.obs,
          scenes: [],
        },
        policy: {
          ...modelContext.services.policy,
          allowedActions: modelContext.services.policy.allowedActions.filter(
            (actionType) => actionType !== "obs.set_scene" && actionType !== "obs.set_source_visibility",
          ),
        },
      },
      context: {
        ...modelContext.context,
        recentActions: [],
        recentModelActions: [],
        recentActionSummary: [],
        cooldowns: {},
        cooldownSummary: {},
      },
    };
  }

  private resolveCueLabelActions(
    actionPlan: ReturnType<ActionPlanParserService["parse"]>,
    modelContext: ModelControlContext,
  ): ReturnType<ActionPlanParserService["parse"]> {
    return {
      ...actionPlan,
      actions: actionPlan.actions.map((action) => this.resolveCueLabelAction(action, modelContext)),
    };
  }

  private resolveCueLabelAction(action: LocalAction, modelContext: ModelControlContext): LocalAction {
    if (
      action.type !== "vts.trigger_hotkey" ||
      this.isVacantCueAction(action) ||
      action.catalogId ||
      action.hotkeyId ||
      !action.cueLabels ||
      action.cueLabels.length === 0
    ) {
      return action;
    }

    const catalogEntry = this.selectCatalogEntryForCueLabels(action.cueLabels, modelContext);

    if (!catalogEntry) {
      return {
        type: "noop",
        actionId: action.actionId,
        reason: `Cue labels ${action.cueLabels.join(", ")} did not map to exactly one safe automation action.`,
      };
    }

    return {
      ...action,
      catalogId: catalogEntry.catalogId,
      catalogVersion: modelContext.services.vts.automationCatalog.version ?? undefined,
      reason: `${action.reason} Matched cueLabels: ${action.cueLabels.join(", ")}.`,
    };
  }

  private selectCatalogEntryForCueLabels(
    cueLabels: VtsCueLabel[],
    modelContext: ModelControlContext,
  ): ModelControlContext["services"]["vts"]["automationCatalog"]["candidates"][number] | null {
    const ignoredCueLabels: VtsCueLabel[] = ["idle", "manual_request", "unknown"];
    const selectableCueLabels = cueLabels.filter((cueLabel) => !ignoredCueLabels.includes(cueLabel));

    if (selectableCueLabels.length === 0) {
      return null;
    }

    const scoredCandidates = modelContext.services.vts.automationCatalog.candidates
      .filter((candidate) => candidate.autoMode === "safe_auto")
      .map((candidate) => ({
        candidate,
        score: candidate.cueLabels.filter((cueLabel) => selectableCueLabels.includes(cueLabel)).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length === 0) {
      return null;
    }

    const [best, secondBest] = scoredCandidates;
    if (!best || (secondBest && secondBest.score === best.score)) {
      return null;
    }

    return best.candidate;
  }

  private isVacantCueAction(action: LocalAction): boolean {
    return (
      action.type === "vts.trigger_hotkey" &&
      Array.isArray(action.cueLabels) &&
      action.cueLabels.includes("vacant")
    );
  }

  private getMappedSafeAutoCueLabels(modelContext: ModelControlContext): VtsCueLabel[] {
    const cueLabels = [
      ...new Set(
        modelContext.services.vts.automationCatalog.candidates
          .filter((candidate) => candidate.autoMode === "safe_auto")
          .flatMap((candidate) => candidate.cueLabels)
          .filter((cueLabel) => !["idle", "manual_request", "unknown"].includes(cueLabel)),
      ),
    ];

    if (!cueLabels.includes("vacant")) {
      cueLabels.push("vacant");
    }

    return cueLabels;
  }

  private filterLiveRecentActions(actions: ModelControlRecentAction[]): ModelControlRecentAction[] {
    return actions
      .filter((action) => action.type !== "noop")
      .slice(0, 4);
  }

  private buildRecentActionSummary(actions: ModelControlRecentModelAction[]): ModelControlRecentActionSummary[] {
    const nowMs = Date.now();

    return actions
      .flatMap((entry) => {
        const ageMs = Math.max(nowMs - Date.parse(entry.storedAt), 0);

        return entry.actionPlan.actions
          .filter((action): action is Extract<LocalAction, { type: "vts.trigger_hotkey" }> => {
            return action.type === "vts.trigger_hotkey" && typeof action.catalogId === "string";
          })
          .flatMap((action) => {
            const result = entry.actionResults.find((candidate) => candidate.actionId === action.actionId);
            const reason = result?.reason?.toLowerCase() ?? "";
            const blockedReasonCode = result?.status === "blocked"
              ? reason.includes("cooldown") || reason.includes("suppressed")
                ? "cooldown"
                : "policy"
              : undefined;

            if (!action.catalogId) {
              return [];
            }

            return [{
              catalogId: action.catalogId,
              actionType: action.type,
              ageMs,
              status: result?.status ?? "not_executed",
              blockedReasonCode,
            } satisfies ModelControlRecentActionSummary];
          });
      })
      .slice(0, 4);
  }

  private buildCooldownSummary(cooldowns: Record<string, number>): Record<string, { remainingMs: number }> {
    return Object.fromEntries(
      Object.entries(cooldowns)
        .filter(([key]) => key.startsWith("vts.catalog:"))
        .map(([key, remainingMs]) => [key.replace("vts.catalog:", ""), { remainingMs }]),
    );
  }

}
