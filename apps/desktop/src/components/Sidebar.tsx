import { useMemo, useState } from "react";
import { useAppStore } from "../stores/app-store";
import {
  IconAt,
  IconClock,
  IconCompose,
  IconFolder,
  IconHelp,
  IconPullRequest,
  IconSearch,
  IconSettings,
} from "./icons";

export function Sidebar({
  collapsed,
  onOpenPalette,
}: {
  collapsed: boolean;
  onOpenPalette: () => void;
}) {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const selectSession = useAppStore((s) => s.selectSession);
  const newSession = useAppStore((s) => s.newSession);
  const openProject = useAppStore((s) => s.openProject);
  const setPage = useAppStore((s) => s.setPage);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const page = useAppStore((s) => s.page);
  const setToast = useAppStore((s) => s.setToast);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || "New chat").toLowerCase().includes(q));
  }, [sessions, query]);

  if (collapsed) {
    return (
      <aside className="flex w-[56px] shrink-0 flex-col border-r border-border-subtle bg-bg-primary">
        <div className="sidebar-drag" />
        <div className="no-drag flex flex-1 flex-col items-center gap-2 px-2 py-2">
          <button className="icon-btn" title="New task" onClick={() => void newSession()}>
            <IconCompose size={16} />
          </button>
          <button className="icon-btn" title="Search" onClick={onOpenPalette}>
            <IconSearch size={16} />
          </button>
          <button className="icon-btn" title="Open project" onClick={() => void openProject()}>
            <IconFolder size={16} />
          </button>
          <div className="flex-1" />
          <button
            className="icon-btn"
            title="Settings"
            onClick={() => {
              setSettingsTab("appearance");
              setPage("settings");
            }}
          >
            <IconSettings size={16} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-drag" />
      <div className="no-drag flex min-h-0 flex-1 flex-col px-3 pb-3">
        <div className="sidebar-header">
          <div className="brand">PI-Desktop</div>
          <button
            className="icon-btn"
            title="Search"
            onClick={() => {
              setSearchOpen((v) => !v);
              if (!searchOpen) onOpenPalette();
            }}
          >
            <IconSearch size={16} />
          </button>
        </div>

        <button className="new-task-btn mb-2" onClick={() => void newSession()}>
          <IconCompose size={15} />
          <span>New task</span>
        </button>

        <nav className="mb-1 space-y-0.5">
          <button className="nav-item" onClick={() => void openProject()}>
            <IconFolder size={15} />
            <span>Projects</span>
          </button>
          <button
            className="nav-item"
            onClick={() => setToast("Pull requests view is not available yet")}
          >
            <IconPullRequest size={15} />
            <span>Pull requests</span>
          </button>
          <button
            className="nav-item"
            onClick={() => setToast("Scheduled tasks view is not available yet")}
          >
            <IconClock size={15} />
            <span>Scheduled</span>
          </button>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => {
              setSettingsTab("plugins");
              setPage("settings");
            }}
          >
            <IconAt size={15} />
            <span>Plugins</span>
          </button>
        </nav>

        <div className="section-label">Recents</div>
        {searchOpen && (
          <div className="mb-2 px-1">
            <input
              className="field-input"
              placeholder="Search threads"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto pr-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-[12.5px] text-text-muted">No recent threads</div>
          ) : (
            filtered.map((session) => (
              <button
                key={session.id}
                className={`thread-item ${activeSessionId === session.id ? "active" : ""}`}
                onClick={() => void selectSession(session.id)}
                title={session.title || "New chat"}
              >
                {session.title || "New chat"}
              </button>
            ))
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
          <button
            className="nav-item flex-1"
            onClick={() => {
              setSettingsTab("appearance");
              setPage("settings");
            }}
          >
            <IconSettings size={15} />
            <span>Settings</span>
          </button>
          <button
            className="icon-btn"
            title="Help / logs"
            onClick={async () => {
              try {
                await (await import("../lib/api")).api.openLogs();
              } catch {
                setToast("Unable to open logs");
              }
            }}
          >
            <IconHelp size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
