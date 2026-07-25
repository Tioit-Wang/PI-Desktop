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
};

export type ModelCapabilities = {
  supportsReasoning: boolean;
  supportedThinkingLevels: ThinkingLevel[];
};

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
  if (input.supportsReasoning === false) {
    return {
      supportsReasoning: false,
      supportedThinkingLevels: ["off"],
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
