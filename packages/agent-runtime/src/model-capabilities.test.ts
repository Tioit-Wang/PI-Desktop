import { describe, expect, it } from "vitest";
import { resolveThinkingCapabilities } from "./model-capabilities.js";

describe("resolveThinkingCapabilities", () => {
  it("uses the exact pi-ai catalog model when available", () => {
    const capabilities = resolveThinkingCapabilities({
      vendorKey: "openai",
      modelId: "gpt-5.1",
      supportsReasoning: false,
    });

    expect(capabilities.supportsReasoning).toBe(true);
    expect(capabilities.supportedThinkingLevels).toEqual([
      "off",
      "low",
      "medium",
      "high",
    ]);
  });

  it("uses the explicit reasoning capability for an unknown model", () => {
    expect(
      resolveThinkingCapabilities({
        vendorKey: "custom",
        modelId: "unknown-reasoning-model",
        supportsReasoning: true,
      }),
    ).toEqual({
      supportsReasoning: true,
      supportedThinkingLevels: ["off", "minimal", "low", "medium", "high"],
    });
  });

  it("defaults unknown models to no reasoning", () => {
    expect(
      resolveThinkingCapabilities({
        vendorKey: "custom",
        modelId: "unknown-model",
      }),
    ).toEqual({
      supportsReasoning: false,
      supportedThinkingLevels: ["off"],
    });
  });
});

