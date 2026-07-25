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

/** Public name used by the desktop main-process provider enrichment. */
export type ThinkingCapabilities = ModelCapabilities;

export type ThinkingCapabilitySet = {
  supportsReasoning: boolean;
  supportedThinkingLevels: readonly ThinkingLevel[];
};

const DEFAULT_REASONING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
];

const THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
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

/**
 * Apply pi-ai's nearest-supported-level rule at the desktop boundary.
 * Keeping this deterministic prevents UI, main, and sidecar from selecting
 * different effective levels when a provider exposes a sparse capability list.
 */
export function clampThinkingLevel(
  capabilities: ThinkingCapabilitySet,
  requested: ThinkingLevel,
): ThinkingLevel {
  if (!capabilities.supportsReasoning) return "off";
  const supported = new Set(capabilities.supportedThinkingLevels ?? ["off"]);
  if (supported.has(requested)) return requested;

  const requestedIndex = THINKING_LEVELS.indexOf(requested);
  for (let index = requestedIndex; index < THINKING_LEVELS.length; index += 1) {
    const candidate = THINKING_LEVELS[index];
    if (supported.has(candidate)) return candidate;
  }
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = THINKING_LEVELS[index];
    if (supported.has(candidate)) return candidate;
  }
  return "off";
}
