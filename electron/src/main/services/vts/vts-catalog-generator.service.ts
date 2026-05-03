import { z } from "zod";
import type { OpenAICompatibleMessage } from "../../../shared/model.types";
import type {
  VtsAutomationMode,
  VtsCueLabel,
  VtsEmoteKind,
  VtsHotkey,
} from "../../../shared/types/vts.types";
import { loadPrompt } from "../../prompts/prompt-loader";
import type { ModelRouterService } from "../model/model-router.service";

export interface VtsGeneratedClassification {
  cueLabels: VtsCueLabel[];
  emoteKind: VtsEmoteKind;
  autoMode: VtsAutomationMode;
  confidence: number;
  source: "model" | "heuristic";
}

const cueLabelValues = [
  "greeting",
  "wave",
  "happy",
  "excited",
  "laughing",
  "evil_laugh",
  "smug",
  "angry",
  "frustrated",
  "shocked",
  "surprised",
  "sad",
  "crying",
  "cute_reaction",
  "love_reaction",
  "confused",
  "embarrassed",
  "sleepy",
  "dramatic_moment",
  "magic_moment",
  "hype_moment",
  "idle",
  "manual_request",
  "unknown",
] as const satisfies readonly VtsCueLabel[];

const emoteKindValues = [
  "expression_reaction",
  "symbol_effect",
  "body_motion",
  "prop_effect",
  "appearance_toggle",
  "outfit_toggle",
  "reset",
  "unknown",
] as const satisfies readonly VtsEmoteKind[];

const classificationResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string().trim().min(1),
    cueLabels: z.array(z.enum(cueLabelValues)).min(1),
    emoteKind: z.enum(emoteKindValues),
    autoMode: z.enum(["safe_auto", "suggest_only", "manual_only"]),
    confidence: z.number().min(0).max(1),
  }).strict()),
}).strict();

function stripMarkdownCodeBlocks(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : text.trim();
}

export function buildHeuristicVtsClassification(hotkey: VtsHotkey): VtsGeneratedClassification {
  const normalized = hotkey.name.trim().toLowerCase();

  if (matchesAny(normalized, ["wave", "hi", "hello", "greet"])) {
    return { cueLabels: ["greeting", "wave"], emoteKind: "body_motion", autoMode: "suggest_only", confidence: 0.7, source: "heuristic" };
  }

  if (matchesAny(normalized, ["laugh", "smile", "giggle"])) {
    return { cueLabels: ["laughing", "happy"], emoteKind: "expression_reaction", autoMode: "safe_auto", confidence: 0.82, source: "heuristic" };
  }

  if (matchesAny(normalized, ["evil laugh"])) {
    return { cueLabels: ["evil_laugh"], emoteKind: "expression_reaction", autoMode: "suggest_only", confidence: 0.8, source: "heuristic" };
  }

  if (matchesAny(normalized, ["surprise", "shock", "startle"])) {
    return { cueLabels: ["surprised", "shocked"], emoteKind: "expression_reaction", autoMode: "safe_auto", confidence: 0.82, source: "heuristic" };
  }

  if (matchesAny(normalized, ["angry", "mad"])) {
    return { cueLabels: ["angry"], emoteKind: "expression_reaction", autoMode: "safe_auto", confidence: 0.8, source: "heuristic" };
  }

  if (matchesAny(normalized, ["excited", "hype"])) {
    return { cueLabels: ["excited", "hype_moment"], emoteKind: "expression_reaction", autoMode: "safe_auto", confidence: 0.8, source: "heuristic" };
  }

  if (matchesAny(normalized, ["heart", "love"])) {
    return { cueLabels: ["love_reaction"], emoteKind: "symbol_effect", autoMode: "safe_auto", confidence: 0.78, source: "heuristic" };
  }

  if (matchesAny(normalized, ["sleep", "yawn", "tired"])) {
    return { cueLabels: ["sleepy"], emoteKind: "expression_reaction", autoMode: "safe_auto", confidence: 0.75, source: "heuristic" };
  }

  if (matchesAny(normalized, ["cry", "tear", "sob", "weep", "sad"])) {
    return { cueLabels: ["sad", "crying"], emoteKind: "expression_reaction", autoMode: "safe_auto", confidence: 0.84, source: "heuristic" };
  }

  if (matchesAny(normalized, ["magic", "fire"])) {
    return { cueLabels: ["magic_moment"], emoteKind: "symbol_effect", autoMode: "suggest_only", confidence: 0.72, source: "heuristic" };
  }

  if (matchesAny(normalized, ["fly", "wing", "tail", "imp", "horn"])) {
    return { cueLabels: ["dramatic_moment"], emoteKind: "prop_effect", autoMode: "suggest_only", confidence: 0.65, source: "heuristic" };
  }

  if (matchesAny(normalized, ["hide", "remove", "color", "hair", "cloth", "outfit"])) {
    return {
      cueLabels: ["manual_request"],
      emoteKind: matchesAny(normalized, ["outfit", "cloth"]) ? "outfit_toggle" : "appearance_toggle",
      autoMode: "manual_only",
      confidence: 0.86,
      source: "heuristic",
    };
  }

  if (normalized.length === 0 || normalized.includes("untitled")) {
    return { cueLabels: ["unknown"], emoteKind: "unknown", autoMode: "manual_only", confidence: 0.2, source: "heuristic" };
  }

  return { cueLabels: ["unknown"], emoteKind: "unknown", autoMode: "manual_only", confidence: 0.35, source: "heuristic" };
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

export class VtsCatalogGeneratorService {
  public constructor(private readonly modelRouter: Pick<ModelRouterService, "requestChat">) {}

  public async generate(hotkeys: VtsHotkey[]): Promise<Record<string, VtsGeneratedClassification>> {
    if (hotkeys.length === 0) {
      return {};
    }

    try {
      const response = await this.modelRouter.requestChat(this.buildMessages(hotkeys));

      if (!response.ok) {
        return this.buildHeuristicMap(hotkeys);
      }

      const parsed = classificationResponseSchema.parse(JSON.parse(stripMarkdownCodeBlocks(response.content)));
      return this.normalizeModelItems(hotkeys, parsed.items);
    } catch {
      return this.buildHeuristicMap(hotkeys);
    }
  }

  private buildMessages(hotkeys: VtsHotkey[]): OpenAICompatibleMessage[] {
    return [
      {
        role: "system",
        content: loadPrompt("vts-hotkey-classifier").content,
      },
      {
        role: "user",
        content: JSON.stringify({
          hotkeys: hotkeys.map((hotkey) => ({
            id: hotkey.hotkeyID,
            name: hotkey.name,
            type: hotkey.type,
            description: hotkey.description,
            file: hotkey.file,
          })),
        }, null, 2),
      },
    ];
  }

  private normalizeModelItems(
    hotkeys: VtsHotkey[],
    items: Array<z.infer<typeof classificationResponseSchema>["items"][number]>,
  ): Record<string, VtsGeneratedClassification> {
    const byId = new Map(items.map((item) => [item.id, item]));
    const result: Record<string, VtsGeneratedClassification> = {};

    for (const hotkey of hotkeys) {
      const item = byId.get(hotkey.hotkeyID);
      result[hotkey.hotkeyID] = item
        ? {
            cueLabels: item.cueLabels,
            emoteKind: item.emoteKind,
            autoMode: item.autoMode,
            confidence: item.confidence,
            source: "model",
          }
        : buildHeuristicVtsClassification(hotkey);
    }

    return result;
  }

  private buildHeuristicMap(hotkeys: VtsHotkey[]): Record<string, VtsGeneratedClassification> {
    return Object.fromEntries(
      hotkeys.map((hotkey) => [hotkey.hotkeyID, buildHeuristicVtsClassification(hotkey)]),
    );
  }
}
