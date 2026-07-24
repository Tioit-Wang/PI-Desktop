import type {
  AgentEventEnvelope,
  AgentPromptRequest,
  AgentPromptResponse,
  AgentStatus,
  AppSettings,
  AppVersionInfo,
  CommandItem,
  HostHealth,
  OnboardingState,
  PluginSummary,
  ProjectWorkspace,
  ProviderCreateInput,
  ProviderPublic,
  ProviderUpdateInput,
  Result,
  SessionDetail,
  SessionSummary,
  ToolPermissionResolution,
} from "@pi-desktop/shared";
import { IPC } from "@pi-desktop/shared";

declare global {
  interface Window {
    piDesktop?: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<Result<T>>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
      channels: typeof IPC;
    };
  }
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!window.piDesktop?.invoke) {
    throw new Error("piDesktop preload bridge unavailable");
  }
  const result = await window.piDesktop.invoke<T>(channel, ...args);
  if (!result.ok) {
    const error = new Error(result.error.message) as Error & {
      code?: string;
      details?: unknown;
    };
    error.code = result.error.code;
    error.details = result.error.details;
    throw error;
  }
  return result.data;
}

export const api = {
  getVersion: () => invoke<AppVersionInfo>(IPC.invoke.appGetVersion),
  health: () => invoke<HostHealth>(IPC.invoke.appHealth),
  getOnboarding: () => invoke<OnboardingState>(IPC.invoke.appGetOnboarding),
  dismissOnboarding: () => invoke(IPC.invoke.appDismissOnboarding),
  listSessions: () =>
    invoke<{ sessions: SessionSummary[] }>(IPC.invoke.sessionList),
  createSession: (input?: Partial<SessionSummary>) =>
    invoke<{ session: SessionSummary }>(IPC.invoke.sessionCreate, input ?? {}),
  getSession: (id: string) =>
    invoke<{ session: SessionDetail | null }>(IPC.invoke.sessionGet, id),
  deleteSession: (id: string) => invoke(IPC.invoke.sessionDelete, id),
  renameSession: (id: string, title: string) =>
    invoke(IPC.invoke.sessionRename, id, title),
  getSettings: () => invoke<AppSettings>(IPC.invoke.settingsGet),
  setSettings: (settings: AppSettings) =>
    invoke(IPC.invoke.settingsSet, settings),
  listProviders: () =>
    invoke<{ providers: ProviderPublic[] }>(IPC.invoke.providersList),
  createProvider: (input: ProviderCreateInput) =>
    invoke<{ provider: ProviderPublic }>(IPC.invoke.providersCreate, input),
  updateProvider: (input: ProviderUpdateInput) =>
    invoke<{ provider: ProviderPublic | null }>(
      IPC.invoke.providersUpdate,
      input,
    ),
  deleteProvider: (id: string) => invoke(IPC.invoke.providersDelete, id),
  testProvider: (id: string) => invoke(IPC.invoke.providersTest, id),
  getProject: () =>
    invoke<{ workspace: ProjectWorkspace | null }>(IPC.invoke.projectGet),
  openProject: () =>
    invoke<{ workspace: ProjectWorkspace | null; canceled?: boolean }>(
      IPC.invoke.projectOpen,
    ),
  clearProject: () => invoke(IPC.invoke.projectClear),
  prompt: (req: AgentPromptRequest) =>
    invoke<AgentPromptResponse>(IPC.invoke.agentPrompt, req),
  abort: (sessionId: string) =>
    invoke(IPC.invoke.agentAbort, { sessionId }),
  getStatus: (sessionId: string) =>
    invoke<{ status: AgentStatus }>(IPC.invoke.agentGetStatus, sessionId),
  resolvePermission: (resolution: ToolPermissionResolution) =>
    invoke(IPC.invoke.toolResolvePermission, resolution),
  listPlugins: () =>
    invoke<{ plugins: PluginSummary[] }>(IPC.invoke.pluginList),
  loadDevPlugin: () => invoke(IPC.invoke.pluginLoadDev),
  enablePlugin: (id: string) => invoke(IPC.invoke.pluginEnable, id),
  disablePlugin: (id: string) => invoke(IPC.invoke.pluginDisable, id),
  uninstallPlugin: (id: string) => invoke(IPC.invoke.pluginUninstall, id),
  searchCommands: (query: string) =>
    invoke<{ commands: CommandItem[] }>(
      IPC.invoke.commandPaletteSearch,
      query,
    ),
  executeCommand: (commandId: string) =>
    invoke(IPC.invoke.commandPaletteExecute, commandId),
  openLogs: () => invoke(IPC.invoke.logOpenFolder),
  onAgentEvent: (listener: (event: AgentEventEnvelope) => void) => {
    if (!window.piDesktop?.on) return () => undefined;
    return window.piDesktop.on(IPC.event.agentMessage, (payload) =>
      listener(payload as AgentEventEnvelope),
    );
  },
  onToast: (listener: (message: string) => void) => {
    if (!window.piDesktop?.on) return () => undefined;
    return window.piDesktop.on(IPC.event.toast, (payload) =>
      listener((payload as { message: string }).message),
    );
  },
};
