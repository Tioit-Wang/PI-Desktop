import { create } from "zustand";
import i18n from "i18next";
import type {
  AgentEventEnvelope,
  AppSettings,
  AppVersionInfo,
  OnboardingState,
  PluginSummary,
  ProjectWorkspace,
  ProviderPublic,
  SessionSummary,
  ThinkingLevel,
  ToolPermissionRequest,
  UiMessage,
} from "@pi-desktop/shared";
import { PROTOCOL_VERSION } from "@pi-desktop/shared";
import { api } from "../lib/api";
import { rememberProject } from "../lib/recent-projects";
import { sessionMatchesProject } from "../lib/sidebar-session-groups";
import { formatToolValue } from "../lib/tool-display";

// Sessions created before locale switches keep their old default title, so
// match against every locale's defaults (case-insensitive), not just the
// active locale's.
const LEGACY_DEFAULT_TITLES = new Set(["new task", "new chat", "新建任务", "新对话"]);

export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Auto-dismiss delay in ms; 0 keeps the toast until dismissed. */
  duration: number;
};

export type ToastOptions = {
  variant?: ToastVariant;
  /** Override the variant default (4s, error 8s); 0 disables auto-dismiss. */
  duration?: number;
};

// Design-system §11.8: default 4s auto-dismiss, errors linger 8s.
const TOAST_DURATION_MS = 4000;
const TOAST_ERROR_DURATION_MS = 8000;
// Visible stack cap — oldest toasts drop first when exceeded.
const TOAST_STACK_LIMIT = 4;
let toastSeq = 0;

function untitledTaskTitle() {
  return i18n.t("chat.untitledTask");
}

export function isDefaultSessionTitle(title?: string | null) {
  const trimmed = (title || "").trim().toLowerCase();
  return (
    !trimmed ||
    LEGACY_DEFAULT_TITLES.has(trimmed) ||
    trimmed === untitledTaskTitle().toLowerCase() ||
    trimmed === i18n.t("nav.newChat").toLowerCase()
  );
}

type AppState = {
  ready: boolean;
  version?: AppVersionInfo;
  healthOk: boolean;
  settings?: AppSettings;
  sessions: SessionSummary[];
  activeSessionId?: string;
  messages: UiMessage[];
  isRunning: boolean;
  /** Run state per session id — sessions run independent agents. */
  runningSessions: Record<string, boolean>;
  providers: ProviderPublic[];
  workspace?: ProjectWorkspace | null;
  onboarding?: OnboardingState;
  plugins: PluginSummary[];
  permission?: ToolPermissionRequest | null;
  toasts: ToastItem[];
  page: "chat" | "projects" | "pulls" | "scheduled" | "plugins" | "settings";
  settingsTab: "general" | "agent" | "import" | "about";
  navStack: Array<{ page: AppState["page"]; sessionId?: string }>;
  navIndex: number;
  error?: string | null;
  errorCode?: string | null;
  bootstrap: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  selectSession: (id: string, opts?: { record?: boolean }) => Promise<void>;
  newSession: (options?: { projectPath?: string | null }) => Promise<void>;
  configureActiveSession: (config: {
    mode: "chat" | "agent";
    providerId?: string;
    modelId?: string;
    thinkingLevel: ThinkingLevel;
  }) => Promise<void>;
  sendPrompt: (content: string) => Promise<void>;
  abort: () => Promise<void>;
  openProject: () => Promise<void>;
  clearProject: () => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshPlugins: () => Promise<void>;
  handleAgentEvent: (envelope: AgentEventEnvelope) => void;
  setPage: (page: AppState["page"], opts?: { record?: boolean }) => void;
  setSettingsTab: (tab: AppState["settingsTab"]) => void;
  navBack: () => void;
  navForward: () => void;
  canNavBack: () => boolean;
  canNavForward: () => boolean;
  resolvePermission: (
    decision: "allow-once" | "allow-session" | "deny",
  ) => Promise<void>;
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
  composerPrefill: string | null;
  prefillComposer: (text: string) => void;
  clearComposerPrefill: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  healthOk: false,
  sessions: [],
  messages: [],
  isRunning: false,
  runningSessions: {},
  providers: [],
  plugins: [],
  permission: null,
  page: "chat",
  settingsTab: "general",
  navStack: [{ page: "chat" }],
  navIndex: 0,
  toasts: [],
  composerPrefill: null,
  error: null,
  errorCode: null,

  bootstrap: async () => {
    try {
      const [version, health, settingsRaw, sessions, providers, project, onboarding, plugins] =
        await Promise.all([
          api.getVersion(),
          api.health(),
          api.getSettings(),
          api.listSessions(),
          api.listProviders(),
          api.getProject(),
          api.getOnboarding(),
          api.listPlugins(),
        ]);
      let settings = settingsRaw;
      // First-run default per D003: Agent. Never force-rewrite an existing
      // user choice on boot (a previous build reset it to chat each launch).
      if (settings && !settings.defaultMode) {
        const next = { ...settings, defaultMode: "agent" as const };
        try {
          await api.setSettings(next);
          settings = next;
        } catch {
          settings = next;
        }
      }
      if (version.protocolVersion !== PROTOCOL_VERSION) {
        set({
          error: `Protocol mismatch: UI ${PROTOCOL_VERSION} vs app ${version.protocolVersion}`,
          errorCode: "PROTOCOL_MISMATCH",
        });
      }
      set({
        ready: true,
        version,
        healthOk: health.ok,
        settings,
        sessions: sessions.sessions,
        providers: providers.providers,
        workspace: project.workspace,
        onboarding,
        plugins: plugins.plugins,
      });
      if (project.workspace?.path) {
        rememberProject({
          path: project.workspace.path,
          name: project.workspace.name || project.workspace.path,
          branch: project.workspace.branch,
        });
      }
      // Codex opens an empty draft home ("What should we build…") rather than
      // restoring a prior transcript as the first paint.
      await get().newSession();
    } catch (e) {
      set({
        ready: true,
        healthOk: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  refreshSessions: async () => {
    const sessions = await api.listSessions();
    set({ sessions: sessions.sessions });
  },

  selectSession: async (id, opts) => {
    const detail = await api.getSession(id);
    const record = opts?.record !== false;
    if (!record) {
      set((s) => ({
        activeSessionId: id,
        messages: detail.session?.messages ?? [],
        page: "chat",
        isRunning: s.runningSessions[id] ?? false,
      }));
      return;
    }
    const entry = { page: "chat" as const, sessionId: id };
    set((s) => {
      const stack = s.navStack.slice(0, s.navIndex + 1);
      const last = stack[stack.length - 1];
      const same = last?.page === "chat" && last?.sessionId === id;
      const nextStack = same ? stack : [...stack, entry].slice(-50);
      return {
        activeSessionId: id,
        messages: detail.session?.messages ?? [],
        page: "chat" as const,
        isRunning: s.runningSessions[id] ?? false,
        navStack: nextStack,
        navIndex: nextStack.length - 1,
      };
    });
  },

  newSession: async (options) => {
    const requestedProjectPath =
      options && "projectPath" in options
        ? options.projectPath ?? null
        : get().workspace?.path ?? null;

    // Codex reuses an empty draft thread instead of stacking "New task" rows.
    for (const session of get().sessions) {
      if (
        !isDefaultSessionTitle(session.title) ||
        !sessionMatchesProject(session, requestedProjectPath)
      ) {
        continue;
      }
      try {
        const detail = await api.getSession(session.id);
        const messages = detail.session?.messages ?? [];
        if (messages.length === 0) {
          if (requestedProjectPath === null && get().workspace) {
            await get().clearProject();
          }
          await get().selectSession(session.id);
          return;
        }
      } catch {
        // fall through to create
      }
    }
    if (requestedProjectPath === null && get().workspace) {
      await get().clearProject();
    }
    const settings = get().settings;
    const defaultProvider = get().providers.find(
      (provider) => provider.id === settings?.defaultProviderId,
    );
    // Older hosts may omit capability metadata; treat those providers as
    // non-reasoning instead of dereferencing an absent levels array.
    const defaultThinkingLevels = Array.isArray(
      defaultProvider?.supportedThinkingLevels,
    )
      ? defaultProvider.supportedThinkingLevels
      : (["off"] as ThinkingLevel[]);
    const defaultThinkingLevel =
      defaultThinkingLevels.includes("off")
        ? "off"
        : defaultThinkingLevels[0] ?? "off";
    const created = await api.createSession({
      title: untitledTaskTitle(),
      mode: settings?.defaultMode ?? "chat",
      providerId: settings?.defaultProviderId,
      modelId: settings?.defaultModelId,
      thinkingLevel: defaultThinkingLevel,
      projectPath: requestedProjectPath ?? undefined,
    });
    await get().refreshSessions();
    const detail = await api.getSession(created.session.id);
    const entry = { page: "chat" as const, sessionId: created.session.id };
    set((s) => {
      const stack = s.navStack.slice(0, s.navIndex + 1);
      const nextStack = [...stack, entry].slice(-50);
      return {
        activeSessionId: created.session.id,
        messages: detail.session?.messages ?? [],
        page: "chat" as const,
        navStack: nextStack,
        navIndex: nextStack.length - 1,
      };
    });
  },

  configureActiveSession: async (config) => {
    const sessionId = get().activeSessionId;
    if (!sessionId || get().runningSessions[sessionId]) return;
    const result = await api.configureSession(sessionId, config);
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId ? result.session : session,
      ),
    }));
  },

  sendPrompt: async (content) => {
    let sessionId = get().activeSessionId;
    if (!sessionId) {
      await get().newSession();
      sessionId = get().activeSessionId;
    }
    if (!sessionId) throw new Error("No active session");
    const startedIn = sessionId;
    set((s) => ({
      isRunning: true,
      error: null,
      errorCode: null,
      runningSessions: { ...s.runningSessions, [startedIn]: true },
    }));
    try {
      const current = get().sessions.find((s) => s.id === sessionId);
      if (isDefaultSessionTitle(current?.title)) {
        const nextTitle =
          content.trim().replace(/\s+/g, " ").slice(0, 48) || untitledTaskTitle();
        try {
          await api.renameSession(sessionId, nextTitle);
          await get().refreshSessions();
        } catch {
          // non-fatal
        }
      }
      await api.prompt({ sessionId, content });
    } catch (e) {
      set((s) => ({
        // The user may have switched sessions while the request was in
        // flight; only reset the spinner if the failed session is visible.
        isRunning: s.activeSessionId === startedIn ? false : s.isRunning,
        runningSessions: { ...s.runningSessions, [startedIn]: false },
        error: e instanceof Error ? e.message : String(e),
        errorCode: (e as { code?: string })?.code ?? null,
      }));
    }
  },

  abort: async () => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;
    await api.abort(sessionId);
    set((s) => ({
      isRunning: false,
      runningSessions: { ...s.runningSessions, [sessionId]: false },
    }));
  },

  openProject: async () => {
    const result = await api.openProject();
    if (!result.canceled) {
      set({ workspace: result.workspace });
      if (result.workspace?.path) {
        rememberProject({
          path: result.workspace.path,
          name: result.workspace.name || result.workspace.path,
          branch: result.workspace.branch,
        });
      }
      const onboarding = await api.getOnboarding();
      set({ onboarding, page: "chat" });
    }
  },

  clearProject: async () => {
    await api.clearProject();
    set({ workspace: null });
    const onboarding = await api.getOnboarding();
    set({ onboarding });
  },

  refreshProviders: async () => {
    const [providers, sessions, settings, onboarding] = await Promise.all([
      api.listProviders(),
      api.listSessions(),
      api.getSettings(),
      api.getOnboarding(),
    ]);
    set({
      providers: providers.providers,
      sessions: sessions.sessions,
      settings,
      onboarding,
    });
  },

  refreshPlugins: async () => {
    const plugins = await api.listPlugins();
    set({ plugins: plugins.plugins });
  },

  handleAgentEvent: (envelope) => {
    const event = envelope.event;
    // Per-session run state: agents run independently per session, so track
    // running/finished for every envelope, visible session or not.
    if (event.type === "agent_start" || event.type === "turn_start") {
      set((s) => ({
        runningSessions: { ...s.runningSessions, [envelope.sessionId]: true },
      }));
    } else if (
      event.type === "agent_end" ||
      event.type === "turn_end" ||
      event.type === "error"
    ) {
      set((s) => ({
        runningSessions: { ...s.runningSessions, [envelope.sessionId]: false },
      }));
    }
    if (envelope.sessionId !== get().activeSessionId) {
      // Cross-session events must not bleed into the visible transcript.
      // Only global concerns pass: permission prompts (dialog is global)
      // and finished turns refreshing the scoped sidebar session groups.
      if (event.type === "tool_permission_request") {
        set({ permission: event.request });
      } else if (event.type === "agent_end" || event.type === "turn_end") {
        void get().refreshSessions();
      }
      return;
    }
    switch (event.type) {
      case "agent_start":
      case "turn_start":
        set({ isRunning: true });
        break;
      case "agent_end":
      case "turn_end":
        set({ isRunning: false });
        void get().refreshSessions();
        break;
      case "message_start":
        set((s) => {
          const exists = s.messages.some((m) => m.id === event.message.id);
          return exists
            ? s
            : { messages: [...s.messages, event.message] };
        });
        break;
      case "message_update":
        // Append when missing: switching back to a mid-stream session reloads
        // the persisted transcript, which doesn't yet contain the message
        // that is still streaming.
        set((s) => {
          const exists = s.messages.some((m) => m.id === event.message.id);
          return {
            messages: exists
              ? s.messages.map((m) =>
                  m.id === event.message.id ? event.message : m,
                )
              : [...s.messages, event.message],
          };
        });
        break;
      case "message_end":
        set((s) => {
          const exists = s.messages.some((m) => m.id === event.message.id);
          return {
            messages: exists
              ? s.messages.map((m) =>
                  m.id === event.message.id ? event.message : m,
                )
              : [...s.messages, event.message],
          };
        });
        break;
      case "tool_start":
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: event.toolCallId,
              role: "tool",
              content: "",
              createdAt: new Date().toISOString(),
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              toolArgs: event.args,
              toolStatus: "running",
              status: "streaming",
            },
          ],
        }));
        break;
      case "tool_update":
        if (event.partialResult === undefined) break;
        set((s) => ({
          messages: s.messages.map((message) =>
            message.toolCallId === event.toolCallId &&
            message.toolStatus === "running"
              ? {
                  ...message,
                  content:
                    typeof event.partialResult === "string"
                      ? event.partialResult
                      : formatToolValue(event.partialResult),
                  toolResult: event.partialResult,
                }
              : message,
          ),
        }));
        break;
      case "tool_end":
        set((s) => ({
          messages: s.messages.map((m) =>
            m.toolCallId === event.toolCallId
              ? {
                  ...m,
                  toolCompletedAt: new Date(envelope.ts).toISOString(),
                  toolDurationMs: Math.max(
                    0,
                    envelope.ts - (Date.parse(m.createdAt) || envelope.ts),
                  ),
                  toolStatus: event.isError ? "error" : "success",
                  toolResult: event.result,
                  content:
                    typeof event.result === "string"
                      ? event.result
                      : JSON.stringify(event.result, null, 2),
                  status: "complete",
                  isError: event.isError,
                }
              : m,
          ),
        }));
        break;
      case "tool_permission_request":
        set({ permission: event.request });
        break;
      case "error":
        set((s) => ({
          isRunning: false,
          error: `${event.error.code}: ${event.error.message}`,
          errorCode: event.error.code,
          messages: s.messages.map((message) =>
            message.role === "tool" && message.toolStatus === "running"
              ? {
                  ...message,
                  toolStatus: "error",
                  status: "error",
                  isError: true,
                }
              : message,
          ),
        }));
        break;
      default:
        break;
    }
  },

  setPage: (page, opts) => {
    const record = opts?.record !== false;
    set((s) => {
      if (!record) return { page };
      const entry = {
        page,
        sessionId: page === "chat" ? s.activeSessionId : undefined,
      };
      const stack = s.navStack.slice(0, s.navIndex + 1);
      const last = stack[stack.length - 1];
      const same =
        last?.page === entry.page && last?.sessionId === entry.sessionId;
      const nextStack = same ? stack : [...stack, entry].slice(-50);
      return {
        page,
        navStack: nextStack,
        navIndex: nextStack.length - 1,
      };
    });
  },
  setSettingsTab: (settingsTab) => {
    get().setPage("settings");
    set({ settingsTab });
  },
  canNavBack: () => get().navIndex > 0,
  canNavForward: () => get().navIndex < get().navStack.length - 1,
  navBack: () => {
    const s = get();
    if (s.navIndex <= 0) return;
    const idx = s.navIndex - 1;
    const entry = s.navStack[idx];
    set({ navIndex: idx, page: entry.page });
    if (entry.page === "chat" && entry.sessionId) {
      void get().selectSession(entry.sessionId, { record: false });
      set({ navIndex: idx });
    }
  },
  navForward: () => {
    const s = get();
    if (s.navIndex >= s.navStack.length - 1) return;
    const idx = s.navIndex + 1;
    const entry = s.navStack[idx];
    set({ navIndex: idx, page: entry.page });
    if (entry.page === "chat" && entry.sessionId) {
      void get().selectSession(entry.sessionId, { record: false });
      set({ navIndex: idx });
    }
  },
  resolvePermission: async (decision) => {
    const permission = get().permission;
    if (!permission) return;
    try {
      await api.resolvePermission({
        requestId: permission.requestId,
        decision,
      });
    } finally {
      // Even if the host already auto-denied (timeout → NOT_FOUND), the
      // dialog must close.
      set({ permission: null });
    }
  },
  showToast: (message, options) => {
    const variant = options?.variant ?? "info";
    const duration =
      options?.duration ??
      (variant === "error" ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS);
    set((state) => {
      // Re-raising an identical toast restarts it instead of stacking a twin.
      const kept = state.toasts.filter(
        (item) => item.message !== message || item.variant !== variant,
      );
      const next = [...kept, { id: ++toastSeq, message, variant, duration }];
      return { toasts: next.slice(-TOAST_STACK_LIMIT) };
    });
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),

  prefillComposer: (text) => set({ composerPrefill: text }),
  clearComposerPrefill: () => set({ composerPrefill: null }),
}));
