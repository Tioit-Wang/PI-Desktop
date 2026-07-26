import { randomUUID } from "node:crypto";
import {
  Agent,
  type AgentEvent,
  type AgentMessage,
  type AgentTool,
} from "@earendil-works/pi-agent-core";
import {
  createModels,
  createProvider,
  Type,
  type Model,
  type Usage,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type {
  AgentEventEnvelope,
  AgentStatus,
  MessageUsage,
  Mode,
  ThinkingLevel,
  UiMessage,
} from "@pi-desktop/shared";
import type { HostClient } from "./host-client.js";
import { clampThinkingLevel } from "./thinking-level.js";


function usageFromPi(usage: Usage | undefined | null): MessageUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = Math.max(0, Math.round(usage.input || 0));
  const outputTokens = Math.max(0, Math.round(usage.output || 0));
  const cacheReadTokens = Math.max(0, Math.round(usage.cacheRead || 0));
  const cacheWriteTokens = Math.max(0, Math.round(usage.cacheWrite || 0));
  const reasoningTokens =
    typeof usage.reasoning === "number"
      ? Math.max(0, Math.round(usage.reasoning))
      : undefined;
  const totalTokens = Math.max(
    0,
    Math.round(
      usage.totalTokens ||
        inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens,
    ),
  );
  if (totalTokens <= 0 && inputTokens <= 0 && outputTokens <= 0) return undefined;
  return {
    inputTokens,
    outputTokens,
    ...(cacheReadTokens > 0 ? { cacheReadTokens } : {}),
    ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    totalTokens,
  };
}

export type RuntimeProviderConfig = {
  id: string;
  name: string;
  baseUrl?: string;
  modelId: string;
  apiKey: string;
  authKind?: string;
  supportsReasoning: boolean;
  supportedThinkingLevels: ThinkingLevel[];
};

export type PluginToolDef = {
  /** Full exposed name (`plugin_<pluginIdSafe>_<toolName>`, D015). */
  name: string;
  description?: string;
  /** JSON schema for arguments (manifest agentTools[].schema). */
  parameters?: unknown;
};

export type AgentRuntimeOptions = {
  host: HostClient;
  sessionId: string;
  mode: Mode;
  provider: RuntimeProviderConfig;
  thinkingLevel: ThinkingLevel;
  systemPrompt?: string;
  /** Persisted transcript to seed the agent with (session isolation: each
   * session's agent carries only its own history). */
  history?: UiMessage[];
  /** Plugin agent tools to expose to the model this session. */
  pluginTools?: PluginToolDef[];
  onEvent: (envelope: AgentEventEnvelope) => void;
};

function nowIso() {
  return new Date().toISOString();
}

const THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

type AssistantContent = {
  text: string;
  thinking: string;
  hasText: boolean;
  hasThinking: boolean;
};

function assistantContent(content: unknown): AssistantContent {
  if (typeof content === "string") {
    return { text: content, thinking: "", hasText: true, hasThinking: false };
  }
  if (!Array.isArray(content)) {
    return { text: "", thinking: "", hasText: false, hasThinking: false };
  }

  let text = "";
  let thinking = "";
  let hasText = false;
  let hasThinking = false;
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const block = part as {
      type?: string;
      text?: string;
      thinking?: string;
    };
    if (block.type === "text" && typeof block.text === "string") {
      hasText = true;
      text += block.text;
    } else if (block.type === "thinking") {
      hasThinking = true;
      if (typeof block.thinking === "string") {
        thinking += block.thinking;
      } else if (typeof block.text === "string") {
        // Accept OpenAI-compatible adapters that expose thinking as `text`.
        thinking += block.text;
      }
    }
  }
  return { text, thinking, hasText, hasThinking };
}

export class DesktopAgentRuntime {
  private agent: Agent;
  private turnId?: string;
  private disposed = false;
  readonly sessionId: string;
  private mode: Mode;
  private provider: RuntimeProviderConfig;
  private thinkingLevel: ThinkingLevel;
  private host: HostClient;
  private onEvent: (envelope: AgentEventEnvelope) => void;
  private currentAssistant?: UiMessage;
  private pluginTools: PluginToolDef[];

  constructor(opts: AgentRuntimeOptions) {
    this.sessionId = opts.sessionId;
    this.mode = opts.mode;
    this.provider = opts.provider;
    this.thinkingLevel = clampThinkingLevel(opts.provider, opts.thinkingLevel);
    this.host = opts.host;
    this.onEvent = opts.onEvent;
    this.pluginTools = opts.pluginTools ?? [];

    const model = this.buildModel();
    const tools = this.buildTools();
    const models = createModels();
    const runtimeApiKey =
      this.provider.apiKey ||
      (this.provider.authKind === "none" ? "pi-desktop-no-auth" : "");
    const provider = createProvider({
      id: this.provider.id,
      name: this.provider.name,
      baseUrl: this.provider.baseUrl,
      auth: {
        apiKey: {
          name: `${this.provider.name} API key`,
          resolve: async () => ({
            auth: { headers: { Authorization: `Bearer ${runtimeApiKey}` } },
          }),
        },
      },
      models: [model],
      api: openAICompletionsApi(),
    });
    models.setProvider(provider);

    this.agent = new Agent({
      streamFn: (m, context, options) => models.streamSimple(m, context, options),
      getApiKey: async () => runtimeApiKey,
      initialState: {
        systemPrompt:
          opts.systemPrompt ??
          "You are PI-Desktop, a local-first coding agent. Prefer concise, actionable answers. Use tools when they help.",
        model,
        tools,
        thinkingLevel: this.thinkingLevel,
        messages: this.historyToAgentMessages(opts.history ?? []),
      },
    });

    this.agent.subscribe((event) => {
      void this.handleAgentEvent(event);
    });
  }

  /** True when this runtime can be reused for a prompt with the given config. */
  matches(
    mode: Mode,
    provider: RuntimeProviderConfig,
    thinkingLevelOrPluginToolNames: ThinkingLevel | string[] = this.thinkingLevel,
    pluginToolNames: string[] = [],
  ): boolean {
    // Keep the pre-thinking overload usable for callers that passed plugin
    // names as the third argument. New callers pass the selected level.
    const legacyPluginToolNames = Array.isArray(thinkingLevelOrPluginToolNames)
      ? thinkingLevelOrPluginToolNames
      : undefined;
    const thinkingLevel: ThinkingLevel = Array.isArray(
      thinkingLevelOrPluginToolNames,
    )
      ? this.thinkingLevel
      : thinkingLevelOrPluginToolNames;
    const effectivePluginToolNames =
      legacyPluginToolNames ?? pluginToolNames;
    const current = this.pluginTools.map((t) => t.name).sort().join(",");
    const next = [...effectivePluginToolNames].sort().join(",");
    const currentThinkingLevels = [
      ...(this.provider.supportedThinkingLevels ?? ["off"]),
    ]
      .sort()
      .join(",");
    const nextThinkingLevels = [
      ...(provider.supportedThinkingLevels ?? ["off"]),
    ]
      .sort()
      .join(",");
    return (
      !this.disposed &&
      this.mode === mode &&
      this.provider.id === provider.id &&
      this.provider.modelId === provider.modelId &&
      (this.provider.baseUrl ?? "") === (provider.baseUrl ?? "") &&
      this.provider.apiKey === provider.apiKey &&
      this.provider.authKind === provider.authKind &&
      this.provider.supportsReasoning === provider.supportsReasoning &&
      currentThinkingLevels === nextThinkingLevels &&
      this.thinkingLevel === clampThinkingLevel(provider, thinkingLevel) &&
      current === next
    );
  }

  /* Rebuild pi-ai messages from the persisted transcript. Tool rows are
   * transcript-only (call/result pairs can't be reconstructed reliably), so
   * only user/assistant text is restored. */
  private historyToAgentMessages(history: UiMessage[]): AgentMessage[] {
    const zeroUsage: Usage = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
    const messages: AgentMessage[] = [];
    for (const m of history) {
      const timestamp = Date.parse(m.createdAt) || Date.now();
      if (m.role === "user") {
        if (!(m.content || "").trim()) continue;
        messages.push({ role: "user", content: m.content, timestamp });
      } else if (m.role === "assistant") {
        const content = [];
        if (m.thinking?.trim()) {
          content.push({ type: "thinking" as const, thinking: m.thinking });
        }
        if (m.content?.trim()) {
          content.push({ type: "text" as const, text: m.content });
        }
        if (content.length === 0) continue;
        messages.push({
          role: "assistant",
          content,
          api: "openai-completions",
          provider: this.provider.id,
          model: this.provider.modelId,
          usage: zeroUsage,
          stopReason: "stop",
          timestamp,
        });
      }
    }
    return messages;
  }

  private buildModel(): Model<"openai-completions"> {
    const thinkingLevelMap: Partial<Record<ThinkingLevel, string | null>> = {};
    for (const level of THINKING_LEVELS) {
      if (!(this.provider.supportedThinkingLevels ?? ["off"]).includes(level)) {
        thinkingLevelMap[level] = null;
      } else if (level === "xhigh" || level === "max") {
        // pi-ai requires extended levels to be explicitly opted into.
        thinkingLevelMap[level] = level;
      }
    }

    return {
      id: this.provider.modelId,
      name: this.provider.modelId,
      api: "openai-completions",
      provider: this.provider.id,
      baseUrl: this.provider.baseUrl ?? "https://api.openai.com/v1",
      reasoning: this.provider.supportsReasoning,
      thinkingLevelMap,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
      compat: {
        supportsDeveloperRole: false,
      },
    };
  }

  private buildTools(): AgentTool[] {
    const exec = (toolName: string): AgentTool => ({
      name: toolName,
      label: toolName,
      description: `${toolName} tool via PI-Desktop host-core`,
      parameters: Type.Object(
        toolName === "Read"
          ? { path: Type.String() }
          : toolName === "Glob"
            ? { pattern: Type.String() }
            : toolName === "Grep"
              ? {
                  pattern: Type.String(),
                  caseInsensitive: Type.Optional(Type.Boolean()),
                }
              : toolName === "Write"
                ? { path: Type.String(), content: Type.String() }
                : toolName === "Edit"
                  ? {
                      path: Type.String(),
                      old_string: Type.String(),
                      new_string: Type.String(),
                    }
                  : { command: Type.String() },
      ),
      execute: async (toolCallId, params) => {
        const result = await this.host.call<{
          ok: boolean;
          content: unknown;
          isError?: boolean;
          errorCode?: string;
          denied?: boolean;
        }>("tools.execute", {
          sessionId: this.sessionId,
          turnId: this.turnId,
          toolCallId,
          toolName,
          args: params,
          mode: this.mode,
          timeoutMs: 60_000,
        });
        const text =
          typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content, null, 2);
        return {
          content: [{ type: "text", text }],
          details: result.content,
        };
      },
    });

    const tools = ["Read", "Glob", "Grep"];
    if (this.mode === "agent") {
      tools.push("Write", "Edit", "Bash");
    }
    const builtins = tools.map(exec);

    const hostExecute = (toolName: string) =>
      exec(toolName).execute;
    const pluginTools: AgentTool[] = this.pluginTools.map((def) => ({
      name: def.name,
      label: def.name,
      description: def.description || `${def.name} plugin tool`,
      parameters: (def.parameters ??
        Type.Object({})) as AgentTool["parameters"],
      execute: hostExecute(def.name),
    }));
    return [...builtins, ...pluginTools];
  }

  private emit(event: AgentEventEnvelope["event"], turnId?: string) {
    this.onEvent({
      sessionId: this.sessionId,
      turnId: turnId ?? this.turnId,
      ts: Date.now(),
      event,
    });
  }

  private async handleAgentEvent(event: AgentEvent) {
    switch (event.type) {
      case "agent_start":
        this.emit({ type: "agent_start" });
        break;
      case "turn_start":
        this.emit({ type: "turn_start" });
        break;
      case "message_start": {
        if (event.message.role === "assistant") {
          const content = assistantContent((event.message as any).content);
          this.currentAssistant = {
            id: randomUUID(),
            role: "assistant",
            content: content.text,
            ...(content.hasThinking && content.thinking
              ? { thinking: content.thinking }
              : {}),
            createdAt: nowIso(),
            status: "streaming",
            modelId: this.provider.modelId,
            providerId: this.provider.id,
          };
          this.emit({ type: "message_start", message: this.currentAssistant });
        }
        // User messages are echoed and persisted by the desktop main process
        // (agentPrompt handler); re-emitting them here would duplicate the
        // bubble in the transcript since each emit mints a fresh id.
        break;
      }
      case "message_update": {
        if (this.currentAssistant && event.message.role === "assistant") {
          const content = assistantContent((event.message as any).content);
          const previousText = this.currentAssistant.content;
          const previousThinking = this.currentAssistant.thinking ?? "";
          const nextText = content.hasText ? content.text : previousText;
          const nextThinking = content.hasThinking
            ? content.thinking
            : previousThinking;
          const deltaText = content.hasText
            ? content.text.startsWith(previousText)
              ? content.text.slice(previousText.length)
              : content.text
            : "";
          const deltaThinking = content.hasThinking
            ? content.thinking.startsWith(previousThinking)
              ? content.thinking.slice(previousThinking.length)
              : content.thinking
            : "";
          this.currentAssistant = {
            ...this.currentAssistant,
            content: nextText,
            ...(nextThinking
              ? { thinking: nextThinking }
              : content.hasThinking
                ? { thinking: undefined }
                : {}),
            status: "streaming",
          };
          this.emit({
            type: "message_update",
            message: this.currentAssistant,
            deltaText,
            ...(deltaThinking ? { deltaThinking } : {}),
          });
        }
        break;
      }
      case "message_end": {
        if (this.currentAssistant && event.message.role === "assistant") {
          const content = assistantContent((event.message as any).content);
          const nextText = content.hasText
            ? content.text
            : this.currentAssistant.content;
          const nextThinking = content.hasThinking
            ? content.thinking
            : this.currentAssistant.thinking ?? "";
          const usage = usageFromPi((event.message as any).usage as Usage | undefined);
          this.currentAssistant = {
            ...this.currentAssistant,
            content: nextText,
            ...(nextThinking
              ? { thinking: nextThinking }
              : content.hasThinking
                ? { thinking: undefined }
                : {}),
            status: "complete",
            modelId: this.provider.modelId,
            providerId: this.provider.id,
            ...(usage ? { usage } : {}),
          };
          this.emit({ type: "message_end", message: this.currentAssistant });
          this.currentAssistant = undefined;
        }
        break;
      }
      case "tool_execution_start":
        this.emit({
          type: "tool_start",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        });
        break;
      case "tool_execution_update":
        this.emit({
          type: "tool_update",
          toolCallId: event.toolCallId,
          partialResult: event.partialResult,
        });
        break;
      case "tool_execution_end":
        this.emit({
          type: "tool_end",
          toolCallId: event.toolCallId,
          result: event.result,
          isError: event.isError,
        });
        break;
      case "turn_end":
        this.emit({ type: "turn_end" });
        break;
      case "agent_end":
        this.emit({
          type: "agent_end",
          messageIds: [],
        });
        break;
      default:
        break;
    }
  }

  async prompt(content: string): Promise<{ turnId: string }> {
    if (this.disposed) throw new Error("runtime disposed");
    this.turnId = randomUUID();
    this.emit({
      type: "status",
      status: this.getStatus(),
    });
    await this.agent.prompt(content);
    await this.agent.waitForIdle();
    return { turnId: this.turnId };
  }

  async abort(): Promise<void> {
    this.agent.abort();
  }

  getStatus(): AgentStatus {
    return {
      sessionId: this.sessionId,
      isRunning: this.agent.state.isStreaming,
      currentTurnId: this.turnId,
      modelId: this.provider.modelId,
      pendingToolConfirmations: 0,
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.agent.abort();
  }
}
