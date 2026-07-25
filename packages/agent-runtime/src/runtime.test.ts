import { describe, expect, it, vi } from "vitest";
import { DesktopAgentRuntime, type RuntimeProviderConfig } from "./runtime.js";
import type { ThinkingLevel, UiMessage } from "@pi-desktop/shared";

const provider: RuntimeProviderConfig = {
  id: "local",
  name: "Local",
  baseUrl: "http://127.0.0.1:11434/v1",
  modelId: "local-model",
  apiKey: "",
  authKind: "none",
  supportsReasoning: true,
  supportedThinkingLevels: ["off", "low", "medium", "high"],
};

function createRuntime(
  overrides: Partial<{
    provider: RuntimeProviderConfig;
    thinkingLevel: ThinkingLevel;
    history: UiMessage[];
    onEvent: (envelope: unknown) => void;
  }> = {},
) {
  return new DesktopAgentRuntime({
    host: { call: vi.fn() } as never,
    sessionId: "session-1",
    mode: "agent",
    provider: overrides.provider ?? provider,
    thinkingLevel: overrides.thinkingLevel ?? "medium",
    history: overrides.history,
    onEvent: overrides.onEvent ?? vi.fn(),
  });
}

describe("DesktopAgentRuntime configuration matching", () => {
  it("accepts no-auth providers and reuses only an exact pi configuration", async () => {
    const runtime = createRuntime();

    expect(runtime.matches("agent", provider, "medium")).toBe(true);
    expect(runtime.matches("chat", provider, "medium")).toBe(false);
    expect(
      runtime.matches("agent", { ...provider, authKind: "api_key" }, "medium"),
    ).toBe(false);
    expect(
      runtime.matches(
        "agent",
        { ...provider, modelId: "another-model" },
        "medium",
      ),
    ).toBe(false);
    expect(runtime.matches("agent", provider, "high")).toBe(false);

    await runtime.dispose();
  });
});

describe("DesktopAgentRuntime thinking configuration", () => {
  it("clamps the requested level and exposes model reasoning capability", async () => {
    const runtime = createRuntime({ thinkingLevel: "minimal" });
    const agent = (runtime as any).agent;

    expect(agent.state.thinkingLevel).toBe("low");
    expect(agent.state.model.reasoning).toBe(true);
    expect(agent.state.model.thinkingLevelMap.minimal).toBeNull();
    expect(agent.state.model.thinkingLevelMap.xhigh).toBeNull();

    await runtime.dispose();
  });

  it("forces off for providers without reasoning support", async () => {
    const noReasoning: RuntimeProviderConfig = {
      ...provider,
      supportsReasoning: false,
      supportedThinkingLevels: ["off"],
    };
    const runtime = createRuntime({
      provider: noReasoning,
      thinkingLevel: "high",
    });
    const agent = (runtime as any).agent;

    expect(agent.state.thinkingLevel).toBe("off");
    expect(agent.state.model.reasoning).toBe(false);

    await runtime.dispose();
  });

  it("restores assistant thinking blocks into the pi transcript", async () => {
    const runtime = createRuntime({
      history: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "answer",
          thinking: "private plan",
          createdAt: new Date().toISOString(),
          status: "complete",
        },
      ],
    });
    const agent = (runtime as any).agent;
    const assistant = agent.state.messages.find(
      (message: any) => message.role === "assistant",
    );

    expect(assistant.content).toEqual([
      { type: "thinking", thinking: "private plan" },
      { type: "text", text: "answer" },
    ]);

    await runtime.dispose();
  });
});

describe("DesktopAgentRuntime assistant thinking events", () => {
  it("normalizes thinking blocks and emits independent thinking deltas", async () => {
    const onEvent = vi.fn();
    const runtime = createRuntime({ onEvent });
    const handleAgentEvent = (runtime as any).handleAgentEvent.bind(runtime);

    await handleAgentEvent({
      type: "message_start",
      message: {
        role: "assistant",
        content: [{ type: "thinking", thinking: "plan " }],
      },
    });
    await handleAgentEvent({
      type: "message_update",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "plan done" },
          { type: "text", text: "answer" },
        ],
      },
    });
    await handleAgentEvent({
      type: "message_end",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "plan done" },
          { type: "text", text: "answer" },
        ],
      },
    });

    const events = onEvent.mock.calls.map(([envelope]) => envelope as any);
    expect(events[0].event.message.thinking).toBe("plan ");
    expect(events[1].event.deltaText).toBe("answer");
    expect(events[1].event.deltaThinking).toBe("done");
    expect(events[1].event.message).toMatchObject({
      content: "answer",
      thinking: "plan done",
    });
    expect(events[2].event.message).toMatchObject({
      content: "answer",
      thinking: "plan done",
      status: "complete",
    });

    await runtime.dispose();
  });
});
