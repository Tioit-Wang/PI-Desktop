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

function taskTitle(title?: string | null) {
  const t = (title || "").trim();
  if (!t || t.toLowerCase() === "new chat") return "New task";
  return t;
}

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
  const setPage = useAppStore((s) => s.setPage);
  const page = useAppStore((s) => s.page);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => taskTitle(s.title).toLowerCase().includes(q));
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
          <button className="icon-btn" title="Projects" onClick={() => setPage("projects")}>
            <IconFolder size={16} />
          </button>
          <div className="flex-1" />
          <button className="icon-btn" title="Settings" onClick={() => setPage("settings")}>
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
            title="Search tasks"
            onClick={() => {
              setSearchOpen((v) => !v);
              onOpenPalette();
            }}
          >
            <IconSearch size={16} />
          </button>
        </div>

        <button
          className="new-task-btn mb-2"
          data-nav="new-task"
          onClick={() => void newSession()}
        >
          <IconCompose size={15} />
          <span>New task</span>
        </button>

        <nav className="mb-1 space-y-0.5">
          <button
            className={`nav-item ${page === "projects" ? "active" : ""}`}
            data-nav="projects"
            onClick={() => setPage("projects")}
          >
            <IconFolder size={15} />
            <span>Projects</span>
          </button>
          <button
            className={`nav-item ${page === "pulls" ? "active" : ""}`}
            data-nav="pulls"
            onClick={() => setPage("pulls")}
          >
            <IconPullRequest size={15} />
            <span>Pull requests</span>
          </button>
          <button
            className={`nav-item ${page === "scheduled" ? "active" : ""}`}
            data-nav="scheduled"
            onClick={() => setPage("scheduled")}
          >
            <IconClock size={15} />
            <span>Scheduled</span>
          </button>
          <button
            className={`nav-item ${page === "plugins" ? "active" : ""}`}
            data-nav="plugins"
            onClick={() => setPage("plugins")}
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
              placeholder="Search tasks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto pr-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-[12.5px] text-text-muted">No recent tasks</div>
          ) : (
            filtered.map((session) => (
              <button
                key={session.id}
                className={`thread-item ${
                  page === "chat" && activeSessionId === session.id ? "active" : ""
                }`}
                onClick={() => void selectSession(session.id)}
                title={taskTitle(session.title)}
              >
                {taskTitle(session.title)}
              </button>
            ))
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
          <button
            className={`nav-item flex-1 ${page === "settings" ? "active" : ""}`}
            data-nav="settings"
            onClick={() => setPage("settings")}
          >
            <IconSettings size={15} />
            <span>Settings</span>
          </button>
          <button
            className="icon-btn"
            title="Open logs"
            onClick={async () => {
              try {
                await (await import("../lib/api")).api.openLogs();
              } catch {
                // ignore
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
