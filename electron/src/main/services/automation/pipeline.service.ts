import type { AutomationAnalyzeNowRequest, AutomationAnalyzeNowResult } from "../../../shared/types/action-plan.types";
import type { ModelControlContext, ModelControlRecentAction, ModelControlRecentModelAction } from "../../../shared/types/observation.types";
import { createId } from "../../utils/ids";
import type { ModelRouterService } from "../model/model-router.service";
import { ActionExecutorService } from "./action-executor.service";
import { ActionPlanParserService } from "./action-plan-parser.service";
import { ActionValidatorService } from "./action-validator.service";
import { CooldownService } from "./cooldown.service";
import { LiveCaptureInputService } from "./live-capture-input.service";
import { ModelActionMemoryService } from "./model-action-memory.service";
import { ObservationBuilderService } from "./observation-builder.service";
import { PromptBuilderService } from "./prompt-builder.service";

export class PipelineService {
  public constructor(
    private readonly observationBuilder: ObservationBuilderService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly modelRouter: ModelRouterService,
    private readonly actionPlanParser: ActionPlanParserService,
    private readonly actionValidator: ActionValidatorService,
    private readonly actionExecutor: ActionExecutorService,
    private readonly cooldownService: CooldownService,
    private readonly liveCaptureInputService: LiveCaptureInputService,
    private readonly modelActionMemoryService: ModelActionMemoryService,
  ) {}

  public async analyzeNow(request: AutomationAnalyzeNowRequest = {}): Promise<AutomationAnalyzeNowResult> {
    try {
      const baseModelContext = await this.observationBuilder.buildModelContext({
        tickId: createId("tick"),
        transcript: request.transcript,
        allowObsActions: request.allowObsActions ?? true,
        recentModelActions: this.modelActionMemoryService.getRecentModelActions(),
      });
      const modelContext = request.useLatestCapture
        ? this.buildLivePromptContext(baseModelContext)
        : baseModelContext;
      const liveCaptureInput = request.useLatestCapture
        ? await this.liveCaptureInputService.buildPromptInput(request.captureWindowMs ?? 2_000)
        : undefined;
      const prompt = this.promptBuilder.buildMessages(modelContext, liveCaptureInput);
      const modelResult = await this.modelRouter.requestActionPlan(prompt.messages);

      if (!modelResult.ok || !modelResult.actionPlan) {
        throw new Error(modelResult.content || "Model provider did not return an action plan.");
      }

      const parsedPlan = this.actionPlanParser.parse(modelResult.actionPlan);
      const reviewedActions = this.actionValidator.reviewActions(
        parsedPlan.actions,
        modelContext,
        parsedPlan.safety.requiresConfirmation,
      );
      const actionResults = await this.actionExecutor.execute(reviewedActions, request.dryRun ?? false);
      this.modelActionMemoryService.record(parsedPlan, actionResults);

      return {
        ok: true,
        modelContext: {
          ...modelContext,
          context: {
            ...modelContext.context,
            recentActions: this.cooldownService.getRecentActions(),
            recentModelActions: this.modelActionMemoryService.getRecentModelActions(),
            cooldowns: this.cooldownService.getRemainingCooldowns(),
          },
        },
        plan: parsedPlan,
        reviewedActions,
        actionResults,
        requestDebug: {
          providerId: modelResult.providerId,
          statusCode: modelResult.status,
          promptTokens: modelResult.usage?.promptTokens ?? null,
          completionTokens: modelResult.usage?.completionTokens ?? null,
          totalTokens: modelResult.usage?.totalTokens ?? null,
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
        recentModelActions: this.filterLiveRecentModelActions(modelContext.context.recentModelActions),
      },
    };
  }

  private filterLiveRecentActions(actions: ModelControlRecentAction[]): ModelControlRecentAction[] {
    return actions
      .filter((action) => action.type !== "noop")
      .slice(0, 4);
  }

  private filterLiveRecentModelActions(actions: ModelControlRecentModelAction[]): ModelControlRecentModelAction[] {
    return actions
      .filter((entry) => entry.actionPlan.actions.some((action) => action.type !== "noop"))
      .slice(0, 2);
  }
}
