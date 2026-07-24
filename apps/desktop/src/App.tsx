import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { Sidebar } from "./components/Sidebar";
import { ContextPanel } from "./components/ContextPanel";
import { ChatTranscript } from "./components/ChatTranscript";
import { Composer } from "./components/Composer";
import { PermissionDialog } from "./components/PermissionDialog";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPage } from "./pages/SettingsPage";
import { useAppStore } from "./stores/app-store";
import { api } from "./lib/api";
import { IconPanel, IconSidebar } from "./components/icons";

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

function projectName(path?: string | null) {
  if (!path) return null;
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

function AppShell() {
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
    const theme = settings?.theme ?? "dark";
    if (theme === "system") {
      document.documentElement.dataset.theme = window.matchMedia(
        "(prefers-color-scheme: light)",
      ).matches
        ? "light"
        : "dark";
    } else {
      document.documentElement.dataset.theme = theme;
    }
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

  const heroProject = useMemo(() => projectName(workspace?.path), [workspace?.path]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-primary text-sm text-text-muted">
        Starting PI-Desktop…
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={sidebarCollapsed}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <section className="main-pane">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[46px] items-center justify-end px-3">
          <div className="pointer-events-auto no-drag flex items-center gap-1">
            <button
              className="icon-btn"
              title="Toggle sidebar"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              <IconSidebar size={15} />
            </button>
            <button
              className={`icon-btn ${contextOpen ? "active" : ""}`}
              title="Toggle context"
              onClick={() => setContextOpen((v) => !v)}
            >
              <IconPanel size={15} />
            </button>
          </div>
        </div>
        <div className="sidebar-drag pointer-events-none absolute inset-x-0 top-0 h-[52px]" />

        {page === "settings" ? (
          <SettingsPage />
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="thread-scroll">
                <div className="empty-hero">
                  <h1>
                    What should we build
                    {heroProject ? (
                      <>
                        {" "}
                        in{" "}
                        <button
                          className="project-underline"
                          onClick={() => void openProject()}
                          title={workspace?.path || "Open project"}
                        >
                          {heroProject}
                        </button>
                        ?
                      </>
                    ) : (
                      "?"
                    )}
                  </h1>
                </div>
              </div>
            ) : (
              <ChatTranscript messages={messages} isRunning={isRunning} />
            )}

            {error && (
              <div className="absolute inset-x-0 bottom-[150px] z-10 flex justify-center px-4">
                <div className="max-w-[820px] rounded-[12px] border border-error/30 bg-bg-secondary px-3 py-2 text-[13px] text-error">
                  {error}
                </div>
              </div>
            )}

            <Composer />
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
