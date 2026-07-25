export type Mode = "chat" | "agent";
export type Risk = "low" | "medium" | "high";
export type PermissionDecision = "allow-once" | "allow-session" | "deny";

export type UiMessageRole = "user" | "assistant" | "system" | "tool";

export type UiMessage = {
  id: string;
  role: UiMessageRole;
  content: string;
  createdAt: string;
  status?: "streaming" | "complete" | "error" | "aborted";
  toolName?: string;
  toolCallId?: string;
  toolStatus?: "running" | "success" | "error" | "denied";
  toolArgs?: unknown;
  toolResult?: unknown;
  toolCompletedAt?: string;
  toolDurationMs?: number;
  isError?: boolean;
};

export type SessionSummary = {
  id: string;
  title: string;
  projectPath?: string;
  modelId?: string;
  providerId?: string;
  mode: Mode;
  updatedAt: string;
  createdAt: string;
};

export type SessionDetail = SessionSummary & {
  messages: UiMessage[];
};

export type AgentStatus = {
  sessionId: string;
  isRunning: boolean;
  currentTurnId?: string;
  modelId?: string;
  pendingToolConfirmations: number;
};

export type AgentPromptRequest = {
  sessionId: string;
  content: string;
};

export type AgentPromptResponse = {
  accepted: boolean;
  turnId: string;
};

export type AgentAbortRequest = {
  sessionId: string;
  turnId?: string;
};

export type ToolPermissionRequest = {
  requestId: string;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  argsPreview: unknown;
  risk: Risk;
  reason: string;
};

export type ToolPermissionResolution = {
  requestId: string;
  decision: PermissionDecision;
};

export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messageIds: string[] }
  | { type: "turn_start" }
  | { type: "turn_end" }
  | { type: "message_start"; message: UiMessage }
  | { type: "message_update"; message: UiMessage; deltaText?: string }
  | { type: "message_end"; message: UiMessage }
  | { type: "tool_start"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool_update"; toolCallId: string; partialResult?: unknown }
  | {
      type: "tool_end";
      toolCallId: string;
      result: unknown;
      isError?: boolean;
    }
  | { type: "tool_permission_request"; request: ToolPermissionRequest }
  | { type: "error"; error: { code: string; message: string; retriable?: boolean } }
  | { type: "status"; status: AgentStatus };

export type AgentEventEnvelope = {
  sessionId: string;
  turnId?: string;
  ts: number;
  event: AgentEvent;
};

export type ProjectWorkspace = {
  path: string;
  name: string;
  /** Best-effort git branch from .git/HEAD when available. */
  branch?: string;
};

export type ProjectRecord = {
  id: number;
  path: string;
  name: string;
  pinned: boolean;
  createdAt: number;
  lastOpenedAt: number;
};

export type PullRequestSummary = {
  number: number;
  title: string;
  url: string;
  author?: string;
  headRefName?: string;
  baseRefName?: string;
  updatedAt?: string;
  isDraft?: boolean;
};

export type ProviderPublic = {
  id: string;
  name: string;
  vendorKey: string;
  type: "native" | "openai_compatible" | "custom";
  protocol: string;
  enabled: boolean;
  baseUrl?: string;
  authKind: string;
  hasSecret: boolean;
  defaultModelId?: string;
  apiStyle?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProviderCreateInput = {
  name: string;
  vendorKey?: string;
  type?: "native" | "openai_compatible" | "custom";
  protocol?: string;
  baseUrl?: string;
  authKind?: string;
  defaultModelId?: string;
  secretValue?: string;
  apiStyle?: string;
};

export type ProviderUpdateInput = Partial<ProviderCreateInput> & {
  id: string;
  enabled?: boolean;
};

export type ModelInfo = {
  modelId: string;
  displayName: string;
  providerId: string;
  contextWindow?: number;
  source: "bundled" | "discovered" | "user";
};

export type AppSettings = {
  defaultProviderId?: string;
  defaultModelId?: string;
  defaultMode: Mode;
  theme: "system" | "light" | "dark";
  enterToSend: boolean;
  onboardingDismissed: boolean;
};

export type PluginSummary = {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  source: "installed" | "dev";
  status: "ready" | "error" | "disabled";
  errorMessage?: string;
  permissions: string[];
  path?: string;
};

export type CommandItem = {
  id: string;
  title: string;
  category?: string;
  keywords?: string[];
  source: "builtin" | "plugin";
  pluginId?: string;
};

export type AppVersionInfo = {
  name: string;
  version: string;
  protocolVersion: number;
  hostProtocolVersion?: number;
  hostVersion?: string;
  platform: string;
  arch: string;
};

export type HostHealth = {
  ok: boolean;
  protocolVersion: number;
  version: string;
  uptimeMs: number;
};

/** Payload of the `hostStatus` push event (backend supervision state). */
export type HostStatusEvent = {
  ok: boolean;
  component?: "host" | "sidecar";
  restarting?: boolean;
  restarted?: boolean;
  fatal?: boolean;
  message?: string;
};

export type OnboardingState = {
  showChecklist: boolean;
  steps: Array<{
    id: string;
    title: string;
    done: boolean;
    action?: string;
  }>;
};


export type ScheduledTaskCadence = "manual" | "hourly" | "daily" | "weekly";

export type ScheduledTask = {
  id: string;
  title: string;
  prompt: string;
  cadence: ScheduledTaskCadence;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
};
