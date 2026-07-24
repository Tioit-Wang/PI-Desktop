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
  error?: string | null;
  bootstrap: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  newSession: () => Promise<void>;
  sendPrompt: (content: string) => Promise<void>;
  abort: () => Promise<void>;
  openProject: () => Promise<void>;
  clearProject: () => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshPlugins: () => Promise<void>;
  handleAgentEvent: (envelope: AgentEventEnvelope) => void;
  setPage: (page: AppState["page"]) => void;
  setSettingsTab: (tab: AppState["settingsTab"]) => void;
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
      if (settings && settings.theme !== "dark") {
        try {
          await api.setSettings({ ...settings, theme: "dark" });
          settings = { ...settings, theme: "dark" };
        } catch {
          settings = { ...settings, theme: "dark" };
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
      if (sessions.sessions[0]) {
        await get().selectSession(sessions.sessions[0].id);
      }
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

  selectSession: async (id) => {
    const detail = await api.getSession(id);
    set({
      activeSessionId: id,
      messages: detail.session?.messages ?? [],
      page: "chat",
    });
  },

  newSession: async () => {
    const settings = get().settings;
    const created = await api.createSession({
      title: "New task",
      mode: settings?.defaultMode ?? "agent",
      providerId: settings?.defaultProviderId,
      modelId: settings?.defaultModelId,
      projectPath: get().workspace?.path,
    } as any);
    await get().refreshSessions();
    const detail = await api.getSession(created.session.id);
    set({
      activeSessionId: created.session.id,
      messages: detail.session?.messages ?? [],
      page: "chat",
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

  setPage: (page) => set({ page }),
  setSettingsTab: (settingsTab) => set({ settingsTab, page: "settings" }),
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
