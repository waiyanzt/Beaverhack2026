import type { AutomationAnalyzeNowRequest, AutomationAnalyzeNowResult } from "../../../shared/types/action-plan.types";
import { createId } from "../../utils/ids";
import type { ModelRouterService } from "../model/model-router.service";
import { ActionExecutorService } from "./action-executor.service";
import { ActionPlanParserService } from "./action-plan-parser.service";
import { ActionValidatorService } from "./action-validator.service";
import { CooldownService } from "./cooldown.service";
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
  ) {}

  public async analyzeNow(request: AutomationAnalyzeNowRequest = {}): Promise<AutomationAnalyzeNowResult> {
    try {
      const modelContext = await this.observationBuilder.buildModelContext({
        tickId: createId("tick"),
        transcript: request.transcript,
      });
      const messages = this.promptBuilder.buildMessages(modelContext);
      const rawPlan = await this.modelRouter.createActionPlan(messages);
      const parsedPlan = this.actionPlanParser.parse(rawPlan);
      const reviewedActions = this.actionValidator.reviewActions(
        parsedPlan.actions,
        modelContext,
        parsedPlan.safety.requiresConfirmation,
      );
      const actionResults = await this.actionExecutor.execute(reviewedActions, request.dryRun ?? false);

      return {
        ok: true,
        modelContext: {
          ...modelContext,
          context: {
            ...modelContext.context,
            recentActions: this.cooldownService.getRecentActions(),
            cooldowns: this.cooldownService.getRemainingCooldowns(),
          },
        },
        plan: parsedPlan,
        reviewedActions,
        actionResults,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Automation pipeline failed.",
      };
    }
  }
}
