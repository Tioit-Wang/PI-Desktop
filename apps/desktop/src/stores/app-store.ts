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
import { rememberProject, setProjectPinned } from "../lib/recent-projects";
import { normalizeProjectPath, sessionMatchesProject } from "../lib/sidebar-session-groups";
import {
  loadSidebarPreferences,
  projectIsArchived,
  projectIsCollapsed,
  projectIsPinned,
  projectWorkspaceFromPath,
  saveSidebarPreferences,
  sessionIsArchived,
  sessionIsPinned,
  sortProjects,
  sortSessions,
  type ProjectMeta,
  type ProjectSort,
  type SessionMeta,
  type SessionSort,
} from "../lib/sidebar-preferences";
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

export type WorkPanelTab = "review" | "terminal" | "browser" | "files";

const WORK_PANEL_STORAGE_KEY = "pi.desktop.workPanel";
const WORK_PANEL_TABS: WorkPanelTab[] = ["review", "terminal", "browser", "files"];
export const WORK_PANEL_MIN_WIDTH = 320;
export const WORK_PANEL_DEFAULT_WIDTH = 420;

function loadWorkPanelPreferences(): {
  open: boolean;
  tab: WorkPanelTab;
  width: number;
} {
  const fallback = {
    open: false,
    tab: "review" as WorkPanelTab,
    width: WORK_PANEL_DEFAULT_WIDTH,
  };
  try {
    const raw = localStorage.getItem(WORK_PANEL_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const width = Number(parsed.width);
    return {
      open: parsed.open === true,
      tab: WORK_PANEL_TABS.includes(parsed.tab as WorkPanelTab)
        ? (parsed.tab as WorkPanelTab)
        : fallback.tab,
      width: Number.isFinite(width)
        ? Math.max(WORK_PANEL_MIN_WIDTH, Math.min(720, width))
        : fallback.width,
    };
  } catch {
    return fallback;
  }
}

function saveWorkPanelPreferences(state: Pick<
  AppState,
  "workPanelOpen" | "workPanelTab" | "workPanelWidth"
>) {
  try {
    localStorage.setItem(
      WORK_PANEL_STORAGE_KEY,
      JSON.stringify({
        open: state.workPanelOpen,
        tab: state.workPanelTab,
        width: state.workPanelWidth,
      }),
    );
  } catch {
    // best-effort persistence
  }
}


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

export type SessionView = {
  sort: SessionSort;
  /** Alias retained for sidebar consumers that use the explicit name. */
  sortBy?: SessionSort;
  /** Whether archived sessions are included in sidebar queries. */
  archived: boolean;
  showArchived?: boolean;
};

export type AppState = {
  ready: boolean;
  version?: AppVersionInfo;
  healthOk: boolean;
  settings?: AppSettings;
  sessions: SessionSummary[];
  /** Renderer-owned conversation presentation metadata. */
  sessionMeta: Record<string, SessionMeta>;
  sessionView: SessionView;
  /** Open project tabs and the host's currently active workspace. */
  openProjects: ProjectWorkspace[];
  openProjectPaths: string[];
  activeProjectPath?: string;
  projectMeta: Record<string, ProjectMeta>;
  /** Kept as a flat map for lightweight consumers (Sidebar). */
  projectCollapsed: Record<string, boolean>;
  projectSort: ProjectSort;
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
  retryAssistantMessage: (messageId: string) => Promise<void>;
  abort: () => Promise<void>;
  openProject: () => Promise<void>;
  activateProject: (path: string) => Promise<ProjectWorkspace | null>;
  openProjectPath: (path: string) => Promise<ProjectWorkspace | null>;
  switchProjectPath: (path: string) => Promise<ProjectWorkspace | null>;
  closeProjectPath: (path: string) => Promise<void>;
  clearProject: () => Promise<void>;
  toggleSessionPinned: (id: string) => void;
  toggleSessionArchived: (id: string) => void;
  archiveSession: (id: string) => void;
  restoreSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  setSessionSort: (sort: SessionSort) => void;
  setSessionArchiveVisibility: (show: boolean) => void;
  setSessionView: (view: Partial<SessionView> | boolean) => void;
  setShowArchived: (show: boolean) => void;
  toggleProjectPinned: (path: string, pinned?: boolean) => void;
  toggleProjectArchived: (path: string) => void;
  restoreProject: (path: string) => void;
  archiveProject: (path: string) => void;
  setProjectCollapsed: (path: string, collapsed?: boolean) => void;
  toggleProjectCollapsed: (path: string) => void;
  closeProject: (path: string) => Promise<void>;
  setProjectSort: (sort: ProjectSort) => void;
  getVisibleSessions: (options?: {
    projectPath?: string | null;
    includeArchived?: boolean;
  }) => SessionSummary[];
  getSortedProjects: () => ProjectWorkspace[];
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
  workPanelOpen: boolean;
  workPanelTab: WorkPanelTab;
  workPanelWidth: number;
  /** Bumped on agent Write/Edit/Bash completion; review tab refetches. */
  reviewRev: number;
  toggleWorkPanel: () => void;
  setWorkPanelOpen: (open: boolean) => void;
  setWorkPanelTab: (tab: WorkPanelTab) => void;
  setWorkPanelWidth: (width: number) => void;
};

const initialSidebarPreferences = loadSidebarPreferences();
const initialWorkPanelPreferences = loadWorkPanelPreferences();

// tool_end events carry no tool name, and cross-session tool calls never
// enter `messages`, so remember names from tool_start envelopes here.
const WORKSPACE_MUTATING_TOOLS = new Set(["Write", "Edit", "Bash"]);
const toolNamesByCallId = new Map<string, string>();
const TOOL_NAME_CACHE_LIMIT = 512;

function decorateSessions(
  sessions: SessionSummary[],
  meta: Record<string, SessionMeta>,
): SessionSummary[] {
  return sessions.map((session) => ({
    ...session,
    pinned: sessionIsPinned(session.id, meta),
    archived: sessionIsArchived(session.id, meta),
  }));
}

function promoteProjectPath(paths: string[], rawPath: string): string[] {
  const key = normalizeProjectPath(rawPath);
  if (!key) return paths;
  const withoutPath = paths.filter(
    (path) => normalizeProjectPath(path) !== key,
  );
  return [...withoutPath, rawPath];
}

function removeProjectPath(paths: string[], rawPath: string): string[] {
  const key = normalizeProjectPath(rawPath);
  return key
    ? paths.filter((path) => normalizeProjectPath(path) !== key)
    : paths;
}

function upsertWorkspace(
  projects: ProjectWorkspace[],
  workspace: ProjectWorkspace,
): ProjectWorkspace[] {
  const key = normalizeProjectPath(workspace.path);
  if (!key) return projects;
  const index = projects.findIndex((item) => normalizeProjectPath(item.path) === key);
  if (index < 0) return [...projects, workspace];
  const next = projects.slice();
  next[index] = { ...next[index], ...workspace };
  return next;
}

function preferencesFromState(state: Pick<
  AppState,
  | "sessionMeta"
  | "projectMeta"
  | "projectSort"
  | "sessionView"
  | "openProjectPaths"
>) {
  return {
    sessionMeta: state.sessionMeta,
    projectMeta: state.projectMeta,
    projectSort: state.projectSort,
    sessionView: state.sessionView,
    openProjectPaths: state.openProjectPaths,
  };
}

function persistCurrentSidebar(getState: () => AppState): void {
  saveSidebarPreferences(preferencesFromState(getState()));
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  healthOk: false,
  sessions: [],
  sessionMeta: initialSidebarPreferences.sessionMeta,
  sessionView: {
    ...initialSidebarPreferences.sessionView,
    sortBy: initialSidebarPreferences.sessionView.sort,
    showArchived: initialSidebarPreferences.sessionView.archived,
  },
  openProjects: initialSidebarPreferences.openProjectPaths.map(projectWorkspaceFromPath),
  openProjectPaths: initialSidebarPreferences.openProjectPaths,
  activeProjectPath: undefined,
  projectMeta: initialSidebarPreferences.projectMeta,
  projectCollapsed: Object.fromEntries(
    Object.entries(initialSidebarPreferences.projectMeta)
      .filter(([, meta]) => meta.collapsed === true)
      .map(([path]) => [path, true]),
  ),
  workPanelOpen: initialWorkPanelPreferences.open,
  workPanelTab: initialWorkPanelPreferences.tab,
  workPanelWidth: initialWorkPanelPreferences.width,
  reviewRev: 0,
  projectSort: initialSidebarPreferences.projectSort,
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
      const currentWorkspace = project.workspace;
      const persistedPaths = get().openProjectPaths;
      // Only explicitly retained tabs are restored. Historical sessions stay
      // available in Projects, but must not silently reopen a tab that was
      // intentionally closed.
      const openProjectPaths = currentWorkspace?.path
        ? promoteProjectPath(persistedPaths, currentWorkspace.path)
        : persistedPaths;
      const openProjects = openProjectPaths.map((path) => projectWorkspaceFromPath(path));
      const hydratedProjects = currentWorkspace
        ? upsertWorkspace(openProjects, currentWorkspace)
        : openProjects;
      const hydratedSessions = decorateSessions(sessions.sessions, get().sessionMeta);
      set({
        ready: true,
        version,
        healthOk: health.ok,
        settings,
        sessions: hydratedSessions,
        providers: providers.providers,
        workspace: currentWorkspace,
        activeProjectPath: currentWorkspace?.path,
        openProjectPaths,
        openProjects: hydratedProjects,
        onboarding,
        plugins: plugins.plugins,
      });
      saveSidebarPreferences(preferencesFromState(get()));
      if (currentWorkspace?.path) {
        rememberProject({
          path: currentWorkspace.path,
          name: currentWorkspace.name || currentWorkspace.path,
          branch: currentWorkspace.branch,
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
    set({ sessions: decorateSessions(sessions.sessions, get().sessionMeta) });
  },

  selectSession: async (id, opts) => {
    const detail = await api.getSession(id);
    const sessionProjectPath = detail.session?.projectPath;
    // Selecting a conversation also selects its project tab. This is what
    // makes several open projects behave like independent sidebar scopes.
    if (sessionProjectPath) {
      if (
        !sessionMatchesProject(
          { projectPath: get().activeProjectPath },
          sessionProjectPath,
        )
      ) {
        const workspace = await get().activateProject(sessionProjectPath);
        if (!workspace) throw new Error("Unable to activate project workspace");
      }
    } else if (get().workspace) {
      // Temporary conversations have no workspace context.
      await get().clearProject();
    }
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
    if (
      requestedProjectPath &&
      !sessionMatchesProject(
        { projectPath: get().activeProjectPath },
        requestedProjectPath,
      )
    ) {
      const workspace = await get().activateProject(requestedProjectPath);
      if (!workspace) throw new Error("Unable to activate project workspace");
    }

    // Codex reuses an empty draft thread instead of stacking "New task" rows.
    for (const session of get().sessions) {
      if (
        !isDefaultSessionTitle(session.title) ||
        sessionIsArchived(session.id, get().sessionMeta) ||
        !sessionMatchesProject(session, requestedProjectPath)
      ) {
        continue;
      }
      let messages: UiMessage[];
      try {
        const detail = await api.getSession(session.id);
        messages = detail.session?.messages ?? [];
      } catch {
        // A stale summary must not prevent creating a replacement draft.
        continue;
      }
      if (messages.length === 0) {
        if (requestedProjectPath === null && get().workspace) {
          await get().clearProject();
        }
        await get().selectSession(session.id);
        return;
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
        session.id === sessionId
          ? {
              ...result.session,
              pinned: sessionIsPinned(sessionId, state.sessionMeta),
              archived: sessionIsArchived(sessionId, state.sessionMeta),
            }
          : session,
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

  retryAssistantMessage: async (messageId) => {
    const state = get();
    if (state.isRunning) return;
    const index = state.messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    const target = state.messages[index];
    if (target.role !== "assistant") return;
    // Prefer the nearest preceding user prompt as the retry seed.
    let prompt = "";
    for (let i = index - 1; i >= 0; i -= 1) {
      const candidate = state.messages[i];
      if (candidate.role === "user" && candidate.content.trim()) {
        prompt = candidate.content;
        break;
      }
    }
    if (!prompt) return;
    await get().sendPrompt(prompt);
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

  activateProject: async (path) => {
    const requestedPath = path.trim();
    if (!requestedPath) return null;
    const result = await api.setProject(requestedPath);
    const workspace = result.workspace;
    if (!workspace?.path) return null;

    set((state) => {
      const switchesVisibleProject =
        normalizeProjectPath(state.activeProjectPath) !==
        normalizeProjectPath(workspace.path);
      const openProjectPaths = promoteProjectPath(
        state.openProjectPaths,
        workspace.path,
      );
      const openProjects = upsertWorkspace(state.openProjects, workspace);
      return {
        workspace,
        activeProjectPath: workspace.path,
        openProjectPaths,
        openProjects,
        page: "chat" as const,
        ...(switchesVisibleProject
          ? {
              activeSessionId: undefined,
              messages: [],
              isRunning: false,
            }
          : {}),
      };
    });
    rememberProject({
      path: workspace.path,
      name: workspace.name || workspace.path,
      branch: workspace.branch,
    });
    persistCurrentSidebar(get);
    return workspace;
  },

  openProjectPath: async (path) => get().activateProject(path),
  switchProjectPath: async (path) => get().activateProject(path),

  closeProjectPath: async (path) => {
    const key = normalizeProjectPath(path);
    if (!key) return;
    const state = get();
    const isActive = normalizeProjectPath(state.activeProjectPath) === key;
    const nextPaths = removeProjectPath(state.openProjectPaths, path);
    if (isActive) {
      const fallbackPath = nextPaths[nextPaths.length - 1];
      try {
        if (fallbackPath) await get().activateProject(fallbackPath);
        else await get().clearProject();
      } catch (error) {
        // Keep the current workspace/tab intact when the fallback fails.
        throw error;
      }
    }
    set((current) => ({
      openProjectPaths: removeProjectPath(current.openProjectPaths, path),
      openProjects: current.openProjects.filter(
        (project) => normalizeProjectPath(project.path) !== key,
      ),
    }));
    persistCurrentSidebar(get);
  },
  closeProject: async (path) => get().closeProjectPath(path),

  openProject: async () => {
    const result = await api.openProject();
    if (!result.canceled && result.workspace) {
      const workspace = result.workspace;
      set((state) => {
        const switchesVisibleProject =
          normalizeProjectPath(state.activeProjectPath) !==
          normalizeProjectPath(workspace.path);
        const openProjectPaths = promoteProjectPath(
          state.openProjectPaths,
          workspace.path,
        );
        return {
          workspace,
          activeProjectPath: workspace.path,
          openProjectPaths,
          openProjects: upsertWorkspace(state.openProjects, workspace),
          page: "chat" as const,
          ...(switchesVisibleProject
            ? {
                activeSessionId: undefined,
                messages: [],
                isRunning: false,
              }
            : {}),
        };
      });
      if (workspace.path) {
        rememberProject({
          path: workspace.path,
          name: workspace.name || workspace.path,
          branch: workspace.branch,
        });
      }
      persistCurrentSidebar(get);
      const onboarding = await api.getOnboarding();
      set({ onboarding, page: "chat" });
    }
  },

  clearProject: async () => {
    await api.clearProject();
    set({
      workspace: null,
      activeProjectPath: undefined,
      activeSessionId: undefined,
      messages: [],
      isRunning: false,
    });
    persistCurrentSidebar(get);
    const onboarding = await api.getOnboarding();
    set({ onboarding });
  },

  toggleSessionPinned: (id) => {
    if (!id) return;
    set((state) => {
      const pinned = !sessionIsPinned(id, state.sessionMeta);
      const sessionMeta = {
        ...state.sessionMeta,
        [id]: { ...(state.sessionMeta[id] || {}), pinned },
      };
      const sessions = state.sessions.map((session) =>
        session.id === id ? { ...session, pinned } : session,
      );
      return { sessionMeta, sessions };
    });
    persistCurrentSidebar(get);
  },

  toggleSessionArchived: (id) => {
    if (!id) return;
    set((state) => {
      const archived = !sessionIsArchived(id, state.sessionMeta);
      const sessionMeta = {
        ...state.sessionMeta,
        [id]: { ...(state.sessionMeta[id] || {}), archived },
      };
      const sessions = state.sessions.map((session) =>
        session.id === id ? { ...session, archived } : session,
      );
      return { sessionMeta, sessions };
    });
    persistCurrentSidebar(get);
  },

  archiveSession: (id) => {
    if (!id) return;
    set((state) => ({
      sessionMeta: {
        ...state.sessionMeta,
        [id]: { ...(state.sessionMeta[id] || {}), archived: true },
      },
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, archived: true } : session,
      ),
    }));
    persistCurrentSidebar(get);
  },

  restoreSession: (id) => {
    if (!id) return;
    set((state) => ({
      sessionMeta: {
        ...state.sessionMeta,
        [id]: { ...(state.sessionMeta[id] || {}), archived: false },
      },
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, archived: false } : session,
      ),
    }));
    persistCurrentSidebar(get);
  },

  deleteSession: async (id) => {
    if (!id) return;
    await api.deleteSession(id);
    set((state) => {
      const sessionMeta = { ...state.sessionMeta };
      delete sessionMeta[id];
      const sessions = state.sessions.filter((session) => session.id !== id);
      const runningSessions = { ...state.runningSessions };
      delete runningSessions[id];
      const retainedNav = state.navStack.filter(
        (entry) => entry.sessionId !== id,
      );
      const navStack =
        retainedNav.length > 0 ? retainedNav : [{ page: "chat" as const }];
      return {
        sessionMeta,
        sessions,
        runningSessions,
        activeSessionId:
          state.activeSessionId === id ? undefined : state.activeSessionId,
        messages: state.activeSessionId === id ? [] : state.messages,
        isRunning: state.activeSessionId === id ? false : state.isRunning,
        permission:
          state.permission?.sessionId === id ? null : state.permission,
        navStack,
        navIndex: Math.min(state.navIndex, navStack.length - 1),
      };
    });
    persistCurrentSidebar(get);
    await get().refreshSessions();
  },

  setSessionSort: (sort) => {
    set((state) => ({
      sessionView: { ...state.sessionView, sort, sortBy: sort },
    }));
    persistCurrentSidebar(get);
  },

  setSessionArchiveVisibility: (show) => {
    set((state) => ({
      sessionView: { ...state.sessionView, archived: show, showArchived: show },
    }));
    persistCurrentSidebar(get);
  },

  setSessionView: (view) => {
    if (typeof view === "boolean") {
      get().setSessionArchiveVisibility(view);
      return;
    }
    if (view.sort || view.sortBy) {
      get().setSessionSort(view.sort ?? view.sortBy ?? get().sessionView.sort);
    }
    if (view.archived !== undefined || view.showArchived !== undefined) {
      get().setSessionArchiveVisibility(view.archived ?? view.showArchived ?? false);
    }
  },

  setShowArchived: (show) => {
    get().setSessionArchiveVisibility(show);
  },

  archiveProject: (path) => {
    const key = normalizeProjectPath(path);
    if (!key) return;
    set((state) => ({
      projectMeta: {
        ...state.projectMeta,
        [key]: { ...(state.projectMeta[key] || {}), archived: true },
      },
    }));
    persistCurrentSidebar(get);
  },

  toggleProjectPinned: (path, requestedPinned) => {
    const key = normalizeProjectPath(path);
    if (!key) return;
    set((state) => {
      const pinned = requestedPinned ?? !projectIsPinned(key, state.projectMeta);
      return {
        projectMeta: {
          ...state.projectMeta,
          [key]: { ...(state.projectMeta[key] || {}), pinned },
        },
      };
    });
    // Keep the projects page's legacy recents index in sync as well.
    try {
      setProjectPinned(path, projectIsPinned(key, get().projectMeta));
    } catch {
      // The durable recent-project index is optional in restricted contexts.
    }
    persistCurrentSidebar(get);
  },

  toggleProjectArchived: (path) => {
    const key = normalizeProjectPath(path);
    if (!key) return;
    set((state) => {
      const archived = !projectIsArchived(key, state.projectMeta);
      return {
        projectMeta: {
          ...state.projectMeta,
          [key]: { ...(state.projectMeta[key] || {}), archived },
        },
      };
    });
    persistCurrentSidebar(get);
  },

  restoreProject: (path) => {
    const key = normalizeProjectPath(path);
    if (!key) return;
    set((state) => ({
      projectMeta: {
        ...state.projectMeta,
        [key]: { ...(state.projectMeta[key] || {}), archived: false },
      },
    }));
    persistCurrentSidebar(get);
  },

  setProjectCollapsed: (path, collapsed) => {
    const key = normalizeProjectPath(path);
    if (!key) return;
    set((state) => {
      const next = collapsed ?? !projectIsCollapsed(key, state.projectMeta);
      return {
        projectCollapsed: { ...state.projectCollapsed, [key]: next },
        projectMeta: {
          ...state.projectMeta,
          [key]: { ...(state.projectMeta[key] || {}), collapsed: next },
        },
      };
    });
    persistCurrentSidebar(get);
  },

  toggleProjectCollapsed: (path) => get().setProjectCollapsed(path),

  setProjectSort: (sort) => {
    set({ projectSort: sort });
    persistCurrentSidebar(get);
  },

  getVisibleSessions: (options) => {
    const state = get();
    const includeArchived = options?.includeArchived ?? state.sessionView.archived;
    const scoped = options && "projectPath" in options
      ? state.sessions.filter((session) =>
          sessionMatchesProject(session, options.projectPath),
        )
      : state.sessions;
    return sortSessions(scoped, state.sessionMeta, state.sessionView.sort, includeArchived);
  },

  getSortedProjects: () => {
    const state = get();
    const projects = state.openProjects.filter(
      (project) => !projectIsArchived(project.path, state.projectMeta),
    );
    return sortProjects(projects, state.projectMeta, state.projectSort);
  },

  refreshProviders: async () => {
    const [providers, sessions, settings, onboarding] = await Promise.all([
      api.listProviders(),
      api.listSessions(),
      api.getSettings(),
      api.getOnboarding(),
    ]);
    set((state) => ({
      providers: providers.providers,
      sessions: decorateSessions(sessions.sessions, state.sessionMeta),
      settings,
      onboarding,
    }));
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
    // Any session's workspace mutation invalidates the review diff; this
    // must precede the cross-session early-return below.
    if (event.type === "tool_start") {
      if (toolNamesByCallId.size >= TOOL_NAME_CACHE_LIMIT) {
        const oldest = toolNamesByCallId.keys().next().value;
        if (oldest !== undefined) toolNamesByCallId.delete(oldest);
      }
      toolNamesByCallId.set(event.toolCallId, event.toolName);
    } else if (event.type === "tool_end") {
      const toolName = toolNamesByCallId.get(event.toolCallId);
      toolNamesByCallId.delete(event.toolCallId);
      if (toolName && WORKSPACE_MUTATING_TOOLS.has(toolName)) {
        set((s) => ({ reviewRev: s.reviewRev + 1 }));
      }
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

  toggleWorkPanel: () => {
    set((state) => ({ workPanelOpen: !state.workPanelOpen }));
    saveWorkPanelPreferences(get());
  },
  setWorkPanelOpen: (open) => {
    set({ workPanelOpen: open });
    saveWorkPanelPreferences(get());
  },
  setWorkPanelTab: (tab) => {
    set({ workPanelTab: tab, workPanelOpen: true });
    saveWorkPanelPreferences(get());
  },
  setWorkPanelWidth: (width) => {
    set({
      workPanelWidth: Math.max(WORK_PANEL_MIN_WIDTH, Math.min(720, width)),
    });
    saveWorkPanelPreferences(get());
  },

  prefillComposer: (text) => set({ composerPrefill: text }),
  clearComposerPrefill: () => set({ composerPrefill: null }),
}));
