# Automation Pipeline

The canonical automation flow is:

`ObservationBuilder -> PromptBuilder -> ModelRouter -> ActionPlanParser -> ActionValidator -> ActionExecutor`

The dashboard model monitor is a development visibility loop, not the canonical action executor. It starts the selected capture sources, sends rolling 10-second camera/screen/audio media windows through `ModelRouter` every second when no previous request is in flight, and prints model responses in the renderer. It does not execute returned actions; production model-generated actions still must pass through validation and execution.

See [SPEC.md](../../SPEC.md) for the full contract.
