import type { ThinkingLevel } from "@pi-desktop/shared";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";

export type ModelCapabilityInput = {
  vendorKey: string;
  modelId: string;
  supportsReasoning?: boolean;
};

export type ModelCapabilities = {
  supportsReasoning: boolean;
  supportedThinkingLevels: ThinkingLevel[];
};

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
 * Resolve capabilities from pi-ai's generated catalog, with explicit
 * provider metadata as a fallback for models that are not catalogued.
 */
export function resolveThinkingCapabilities(
  input: ModelCapabilityInput,
): ModelCapabilities {
  const model = getBuiltinCatalog().getModel(input.vendorKey, input.modelId);
  if (model) {
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

