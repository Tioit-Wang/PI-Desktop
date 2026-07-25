import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./components/Sidebar";
import { ContextPanel } from "./components/ContextPanel";
import { ChatTranscript } from "./components/ChatTranscript";
import { Composer } from "./components/Composer";
import { HomeSuggestions } from "./components/HomeSuggestions";
import { PermissionDialog } from "./components/PermissionDialog";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPage } from "./pages/SettingsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { PullRequestsPage } from "./pages/PullRequestsPage";
import { ScheduledPage } from "./pages/ScheduledPage";
import { PluginsPage } from "./pages/PluginsPage";
import { useAppStore } from "./stores/app-store";
import { api } from "./lib/api";
import { IconCodexHome, IconPanel } from "./components/icons";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crash", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-bg-primary p-8 text-text-primary">
          <div className="max-w-lg rounded-[16px] border border-border-default bg-bg-secondary p-5">
            <div className="mb-2 text-[15px] font-semibold">PI-Desktop UI crashed</div>
            <pre className="whitespace-pre-wrap text-[12.5px] text-error">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function projectName(path?: string | null, name?: string | null) {
  if (name) return name;
  if (!path) return null;
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

function AppShell() {
  const { t } = useTranslation();
  const bootstrap = useAppStore((s) => s.bootstrap);
  const ready = useAppStore((s) => s.ready);
  const page = useAppStore((s) => s.page);
  const messages = useAppStore((s) => s.messages);
  const error = useAppStore((s) => s.error);
  const toast = useAppStore((s) => s.toast);
  const setToast = useAppStore((s) => s.setToast);
  const handleAgentEvent = useAppStore((s) => s.handleAgentEvent);
  const isRunning = useAppStore((s) => s.isRunning);
  const abort = useAppStore((s) => s.abort);
  const settings = useAppStore((s) => s.settings);
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  useEffect(() => {
    const theme = settings?.theme ?? "system";
    const apply = () => {
      if (theme === "system") {
        document.documentElement.dataset.theme = window.matchMedia(
          "(prefers-color-scheme: light)",
        ).matches
          ? "light"
          : "dark";
      } else {
        document.documentElement.dataset.theme = theme;
      }
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings?.theme]);

  useEffect(() => {
    void bootstrap();
    const offEvent = api.onAgentEvent(handleAgentEvent);
    const offToast = api.onToast((message) => {
      setToast(message);
      window.setTimeout(() => setToast(null), 2500);
    });
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        void abort();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offEvent();
      offToast();
      window.removeEventListener("keydown", onKey);
    };
  }, [bootstrap, handleAgentEvent, setToast, abort]);

  const heroProject = useMemo(
    () => projectName(workspace?.path, workspace?.name),
    [workspace?.path, workspace?.name],
  );

  const emptyTitleParts = useMemo(() => {
    const marker = "__PROJECT__";
    const template = t("chat.emptyTitleInProject", { project: marker });
    const [before = "", after = ""] = template.split(marker);
    return { before, after };
  }, [t]);

  useEffect(() => {
    (window as any).__PI_DESKTOP__ = {
      setPage: (page: string) => useAppStore.getState().setPage(page as any),
      setSettingsTab: (tab: string) => useAppStore.getState().setSettingsTab(tab as any),
      setThemeAttr: (theme: "light" | "dark") => {
        document.documentElement.dataset.theme = theme;
      },
      clearProject: () => useAppStore.getState().clearProject(),
    };
    return () => {
      try {
        delete (window as any).__PI_DESKTOP__;
      } catch {
        // ignore
      }
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-primary text-sm text-text-muted">
        {t("app.starting")}
      </div>
    );
  }

  const showComposer = page === "chat";
  const hasTranscript = messages.some((m) => {
    if (m.role === "assistant" && !(m.content || "").trim()) return false;
    return Boolean((m.content || "").trim()) || m.role === "tool";
  });

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={sidebarCollapsed}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <section className="main-pane">
        <div className="main-titlebar">
          <div className="main-titlebar-right no-drag">
            <button
              className={`title-nav-btn ${contextOpen ? "active" : ""}`}
              title="Toggle context"
              onClick={() => setContextOpen((v) => !v)}
            >
              <IconPanel size={14} />
            </button>
          </div>
        </div>

        {page === "settings" ? (
          <SettingsPage />
        ) : page === "projects" ? (
          <ProjectsPage />
        ) : page === "pulls" ? (
          <PullRequestsPage />
        ) : page === "scheduled" ? (
          <ScheduledPage />
        ) : page === "plugins" ? (
          <PluginsPage />
        ) : (
          <>
            {!hasTranscript ? (
              <div className="home-main-content">
                <div className="home-upper">
                  <div className="home-upper-inner">
                    <div className="empty-hero">
                      <div className="empty-hero-icon" data-testid="home-icon" aria-hidden>
                        <IconCodexHome size={56} />
                      </div>
                      <h1>
                        {heroProject ? (
                          <>
                            {emptyTitleParts.before}
                            <button
                              type="button"
                              className="project-underline"
                              onClick={() => void openProject()}
                              title={workspace?.path || t("project.open")}
                            >
                              {heroProject}
                            </button>
                            {emptyTitleParts.after}
                          </>
                        ) : (
                          t("chat.emptyTitle")
                        )}
                      </h1>
                    </div>
                    {/* Codex portals ambient cards under hero (top-full mt-8), not in lower flex flow */}
                    <div className="home-suggestions-portal">
                      <HomeSuggestions />
                    </div>
                  </div>
                </div>
                <div className="home-lower">
                  {showComposer && (
                    <div className="home-composer-wrap">
                      <Composer variant="home" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <ChatTranscript messages={messages} isRunning={isRunning} />
                {showComposer && <Composer variant="docked" />}
              </>
            )}

            {error && (
              <div className="absolute inset-x-0 bottom-[150px] z-10 flex justify-center px-4">
                <div className="max-w-[820px] rounded-[12px] border border-error/30 bg-bg-secondary px-3 py-2 text-[13px] text-error">
                  {error}
                </div>
              </div>
            )}
          </>
        )}
        {contextOpen && <ContextPanel onClose={() => setContextOpen(false)} />}
      </section>

      <PermissionDialog />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
