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
  ToolPermissionRequest,
  UiMessage,
} from "@pi-desktop/shared";
import { PROTOCOL_VERSION } from "@pi-desktop/shared";
import { api } from "../lib/api";
import { rememberProject } from "../lib/recent-projects";

// Sessions created before locale switches keep their old default title, so
// match against every locale's defaults (case-insensitive), not just the
// active locale's.
const LEGACY_DEFAULT_TITLES = new Set(["new task", "new chat", "新建任务", "新对话"]);

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
  providers: ProviderPublic[];
  workspace?: ProjectWorkspace | null;
  onboarding?: OnboardingState;
  plugins: PluginSummary[];
  permission?: ToolPermissionRequest | null;
  toast?: string | null;
  page: "chat" | "projects" | "pulls" | "scheduled" | "plugins" | "settings";
  settingsTab:
    | "general"
    | "appearance"
    | "voice"
    | "providers"
    | "agent"
    | "personalization"
    | "keyboard"
    | "account"
    | "plugins"
    | "mcp"
    | "browser"
    | "computer"
    | "hooks"
    | "connections"
    | "git"
    | "pets"
    | "appshots"
    | "about";
  navStack: Array<{ page: AppState["page"]; sessionId?: string }>;
  navIndex: number;
  error?: string | null;
  errorCode?: string | null;
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
  providers: [],
  plugins: [],
  permission: null,
  page: "chat",
  settingsTab: "general",
  navStack: [{ page: "chat" }],
  navIndex: 0,
  toast: null,
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
    // Codex reuses an empty draft thread instead of stacking "New task" rows.
    for (const session of get().sessions) {
      if (!isDefaultSessionTitle(session.title)) continue;
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
      title: untitledTaskTitle(),
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
    set({ isRunning: true, error: null, errorCode: null });
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
      set({
        isRunning: false,
        error: e instanceof Error ? e.message : String(e),
        errorCode: (e as { code?: string })?.code ?? null,
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
    const event = envelope.event;
    if (envelope.sessionId !== get().activeSessionId) {
      // Cross-session events must not bleed into the visible transcript.
      // Only global concerns pass: permission prompts (dialog is global)
      // and finished turns refreshing the recents list.
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
          errorCode: event.error.code,
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

  prefillComposer: (text) => set({ composerPrefill: text }),
  clearComposerPrefill: () => set({ composerPrefill: null }),
}));
