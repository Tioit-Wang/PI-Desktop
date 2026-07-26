import type { ThinkingLevel } from "@pi-desktop/shared";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
export {
  clampThinkingLevel,
  type ThinkingCapabilitySet,
} from "./thinking-level.js";

export type ModelCapabilityInput = {
  vendorKey: string;
  modelId: string;
  supportsReasoning?: boolean;
  /**
   * Optional sparse override for custom/compatible providers.
   * Example: ["off", "high"] for boolean-like thinking support.
   */
  supportedThinkingLevels?: readonly ThinkingLevel[];
};

export type ModelCapabilities = {
  supportsReasoning: boolean;
  supportedThinkingLevels: ThinkingLevel[];
};

const CANONICAL_THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

function normalizeExplicitThinkingLevels(
  levels: readonly ThinkingLevel[] | undefined,
): ThinkingLevel[] | undefined {
  if (!levels) return undefined;
  const allowed = new Set<ThinkingLevel>(CANONICAL_THINKING_LEVELS);
  const out: ThinkingLevel[] = [];
  for (const level of levels) {
    if (!allowed.has(level) || out.includes(level)) continue;
    out.push(level);
  }
  return out.length > 0 ? out : undefined;
}

/** Public name used by the desktop main-process provider enrichment. */
export type ThinkingCapabilities = ModelCapabilities;

const DEFAULT_REASONING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
];

let cachedBuiltinModels: ReturnType<typeof builtinModels> | undefined;

function getBuiltinCatalog() {
  cachedBuiltinModels ??= builtinModels();
  return cachedBuiltinModels;
}

/**
 * Resolve capabilities from pi-ai's generated catalog.
 *
 * An explicit provider override is authoritative. This matters for custom
 * OpenAI-compatible endpoints whose model id happens to match a catalogued
 * model but exposes different reasoning semantics.
 */
export function resolveThinkingCapabilities(
  input: ModelCapabilityInput,
): ModelCapabilities {
  const model = getBuiltinCatalog().getModel(input.vendorKey, input.modelId);
  const explicitLevels = normalizeExplicitThinkingLevels(
    input.supportedThinkingLevels,
  );

  if (input.supportsReasoning === false) {
    return {
      supportsReasoning: false,
      supportedThinkingLevels: ["off"],
    };
  }

  // Explicit sparse sets win for custom/compatible endpoints, including when
  // the model id collides with a catalog entry but only exposes boolean-like
  // thinking support such as ["off", "high"].
  if (explicitLevels) {
    const levels = explicitLevels.includes("off")
      ? explicitLevels
      : (["off", ...explicitLevels] as ThinkingLevel[]);
    return {
      supportsReasoning: true,
      supportedThinkingLevels: levels,
    };
  }

  if (model?.reasoning) {
    return {
      supportsReasoning: model.reasoning,
      supportedThinkingLevels: [
        ...getSupportedThinkingLevels(model),
      ] as ThinkingLevel[],
    };
  }

  if (input.supportsReasoning === true) {
    return {
      supportsReasoning: true,
      supportedThinkingLevels: [...DEFAULT_REASONING_LEVELS],
    };
  }

  return {
    supportsReasoning: false,
    supportedThinkingLevels: ["off"],
  };
}
