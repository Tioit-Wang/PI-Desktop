import { describe, expect, it } from "vitest";
import {
  clampThinkingLevel,
  resolveThinkingCapabilities,
  type ModelCapabilities,
} from "./model-capabilities.js";
import type { ThinkingLevel } from "@pi-desktop/shared";

describe("resolveThinkingCapabilities", () => {
  it("uses the exact pi-ai catalog model when available", () => {
    const capabilities = resolveThinkingCapabilities({
      vendorKey: "openai",
      modelId: "gpt-5.1",
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

  it("honors an explicit false override even for a catalogued model", () => {
    expect(
      resolveThinkingCapabilities({
        vendorKey: "openai",
        modelId: "gpt-5.1",
        supportsReasoning: false,
      }),
    ).toEqual({
      supportsReasoning: false,
      supportedThinkingLevels: ["off"],
    });
  });

  it("clamps sparse capability lists using the nearest supported level", () => {
    const capabilities: ModelCapabilities = {
      supportsReasoning: true,
      supportedThinkingLevels: ["off", "low", "high"] as ThinkingLevel[],
    };
    expect(clampThinkingLevel(capabilities, "minimal")).toBe("low");
    expect(clampThinkingLevel(capabilities, "max")).toBe("high");
  });
});
