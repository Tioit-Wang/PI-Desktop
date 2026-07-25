import { create } from "zustand";
import type {
  AgentEventEnvelope,
  AppSettings,
  AppVersionInfo,
  OnboardingState,
  PluginSummary,
  ProjectWorkspace,
  ProviderPublic,
  SessionSummary,
  ToolPermissionRequest,
  UiMessage,
} from "@pi-desktop/shared";
import { api } from "../lib/api";
import { rememberProject } from "../lib/recent-projects";

type AppState = {
  ready: boolean;
  version?: AppVersionInfo;
  healthOk: boolean;
  settings?: AppSettings;
  sessions: SessionSummary[];
  activeSessionId?: string;
  messages: UiMessage[];
  isRunning: boolean;
  providers: ProviderPublic[];
  workspace?: ProjectWorkspace | null;
  onboarding?: OnboardingState;
  plugins: PluginSummary[];
  permission?: ToolPermissionRequest | null;
  toast?: string | null;
  page: "chat" | "projects" | "pulls" | "scheduled" | "plugins" | "settings";
  settingsTab: "providers" | "plugins" | "appearance" | "about";
  navStack: Array<{ page: AppState["page"]; sessionId?: string }>;
  navIndex: number;
  error?: string | null;
  bootstrap: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  selectSession: (id: string, opts?: { record?: boolean }) => Promise<void>;
  newSession: () => Promise<void>;
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
  setToast: (message: string | null) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  healthOk: false,
  sessions: [],
  messages: [],
  isRunning: false,
  providers: [],
  plugins: [],
  permission: null,
  page: "chat",
  settingsTab: "providers",
  navStack: [{ page: "chat" }],
  navIndex: 0,
  toast: null,
  error: null,

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
      // Match Codex defaults without pinning theme: chat mode is the home default.
      if (settings && settings.defaultMode !== "chat") {
        const next = { ...settings, defaultMode: "chat" as const };
        try {
          await api.setSettings(next);
          settings = next;
        } catch {
          settings = next;
        }
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
      set({
        activeSessionId: id,
        messages: detail.session?.messages ?? [],
        page: "chat",
      });
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
        navStack: nextStack,
        navIndex: nextStack.length - 1,
      };
    });
  },

  newSession: async () => {
    const isDefaultTitle = (title?: string | null) => {
      const t = (title || "").trim();
      return !t || t === "New task" || t === "New chat" || t === "新建任务";
    };
    // Codex reuses an empty draft thread instead of stacking "New task" rows.
    for (const session of get().sessions) {
      if (!isDefaultTitle(session.title)) continue;
      try {
        const detail = await api.getSession(session.id);
        const messages = detail.session?.messages ?? [];
        if (messages.length === 0) {
          await get().selectSession(session.id);
          return;
        }
      } catch {
        // fall through to create
      }
    }
    const settings = get().settings;
    const created = await api.createSession({
      title: "New task",
      mode: settings?.defaultMode ?? "chat",
      providerId: settings?.defaultProviderId,
      modelId: settings?.defaultModelId,
      projectPath: get().workspace?.path,
    } as any);
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

  sendPrompt: async (content) => {
    let sessionId = get().activeSessionId;
    if (!sessionId) {
      await get().newSession();
      sessionId = get().activeSessionId;
    }
    if (!sessionId) throw new Error("No active session");
    set({ isRunning: true, error: null });
    try {
      const current = get().sessions.find((s) => s.id === sessionId);
      const title = (current?.title || "").trim();
      const isDefault =
        !title ||
        title === "New task" ||
        title === "New chat" ||
        title === "新建任务";
      if (isDefault) {
        const nextTitle = content.trim().replace(/\s+/g, " ").slice(0, 48) || "New task";
        try {
          await api.renameSession(sessionId, nextTitle);
          await get().refreshSessions();
        } catch {
          // non-fatal
        }
      }
      await api.prompt({ sessionId, content });
    } catch (e) {
      set({
        isRunning: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  abort: async () => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;
    await api.abort(sessionId);
    set({ isRunning: false });
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
    const providers = await api.listProviders();
    const settings = await api.getSettings();
    const onboarding = await api.getOnboarding();
    set({ providers: providers.providers, settings, onboarding });
  },

  refreshPlugins: async () => {
    const plugins = await api.listPlugins();
    set({ plugins: plugins.plugins });
  },

  handleAgentEvent: (envelope) => {
    if (envelope.sessionId !== get().activeSessionId) {
      // still track running state lightly
    }
    const event = envelope.event;
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
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === event.message.id ? event.message : m,
          ),
        }));
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
      case "tool_end":
        set((s) => ({
          messages: s.messages.map((m) =>
            m.toolCallId === event.toolCallId
              ? {
                  ...m,
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
        set({
          isRunning: false,
          error: `${event.error.code}: ${event.error.message}`,
        });
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
    await api.resolvePermission({
      requestId: permission.requestId,
      decision,
    });
    set({ permission: null });
  },
  setToast: (message) => set({ toast: message }),
}));
