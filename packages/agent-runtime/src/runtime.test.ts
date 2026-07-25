import { describe, expect, it, vi } from "vitest";
import { DesktopAgentRuntime, type RuntimeProviderConfig } from "./runtime.js";

const provider: RuntimeProviderConfig = {
  id: "local",
  name: "Local",
  baseUrl: "http://127.0.0.1:11434/v1",
  modelId: "local-model",
  apiKey: "",
  authKind: "none",
};

function createRuntime() {
  return new DesktopAgentRuntime({
    host: { call: vi.fn() } as never,
    sessionId: "session-1",
    mode: "agent",
    provider,
    onEvent: vi.fn(),
  });
}

describe("DesktopAgentRuntime configuration matching", () => {
  it("accepts no-auth providers and reuses only an exact pi configuration", async () => {
    const runtime = createRuntime();

    expect(runtime.matches("agent", provider)).toBe(true);
    expect(runtime.matches("chat", provider)).toBe(false);
    expect(
      runtime.matches("agent", { ...provider, authKind: "api_key" }),
    ).toBe(false);
    expect(
      runtime.matches("agent", { ...provider, modelId: "another-model" }),
    ).toBe(false);

    await runtime.dispose();
  });
});
