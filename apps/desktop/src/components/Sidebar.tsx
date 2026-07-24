import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const selectSession = useAppStore((s) => s.selectSession);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const page = useAppStore((s) => s.page);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const taskTitle = (title?: string | null) => {
    const value = (title || "").trim();
    if (
      !value ||
      value.toLowerCase() === "new chat" ||
      value.toLowerCase() === "new task" ||
      value === "新建任务"
    ) {
      return t("chat.untitledTask");
    }
    return value;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => taskTitle(s.title).toLowerCase().includes(q));
  }, [sessions, query, t]);

  if (collapsed) {
    return (
      <aside className="flex w-[56px] shrink-0 flex-col border-r border-border-subtle bg-bg-primary">
        <div className="sidebar-drag" />
        <div className="no-drag flex flex-1 flex-col items-center gap-2 px-2 py-2">
          <button
            className="icon-btn"
            title={t("nav.newTask")}
            data-nav="new-task"
            onClick={() => void newSession()}
          >
            <IconCompose size={16} />
          </button>
          <button className="icon-btn" title={t("nav.search")} onClick={onOpenPalette}>
            <IconSearch size={16} />
          </button>
          <button
            className="icon-btn"
            title={t("nav.projects")}
            data-nav="projects"
            onClick={() => setPage("projects")}
          >
            <IconFolder size={16} />
          </button>
          <div className="flex-1" />
          <button
            className="icon-btn"
            title={t("nav.custom")}
            data-nav="settings"
            onClick={() => setPage("settings")}
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
      <div className="no-drag flex min-h-0 flex-1 flex-col px-2.5 pb-2">
        <div className="sidebar-header">
          <div className="brand">{t("app.shellName")}</div>
          <button
            className="icon-btn"
            title={t("nav.search")}
            onClick={() => {
              setSearchOpen((v) => !v);
              onOpenPalette();
            }}
          >
            <IconSearch size={15} />
          </button>
        </div>

        <button
          className="new-task-btn mb-1.5"
          data-nav="new-task"
          onClick={() => void newSession()}
        >
          <IconCompose size={15} />
          <span>{t("nav.newTask")}</span>
        </button>

        <nav className="mb-1 space-y-0.5 px-0.5">
          <button
            className={`nav-item ${page === "projects" ? "active" : ""}`}
            data-nav="projects"
            onClick={() => setPage("projects")}
          >
            <IconFolder size={15} />
            <span>{t("nav.projects")}</span>
          </button>
          <button
            className={`nav-item ${page === "pulls" ? "active" : ""}`}
            data-nav="pulls"
            onClick={() => setPage("pulls")}
          >
            <IconPullRequest size={15} />
            <span>{t("nav.pullRequests")}</span>
          </button>
          <button
            className={`nav-item ${page === "scheduled" ? "active" : ""}`}
            data-nav="scheduled"
            onClick={() => setPage("scheduled")}
          >
            <IconClock size={15} />
            <span>{t("nav.scheduled")}</span>
          </button>
          <button
            className={`nav-item ${page === "plugins" ? "active" : ""}`}
            data-nav="plugins"
            onClick={() => setPage("plugins")}
          >
            <IconAt size={15} />
            <span>{t("nav.plugins")}</span>
          </button>
        </nav>

        <div className="section-label">{t("nav.recents")}</div>
        {searchOpen && (
          <div className="mb-2 px-1">
            <input
              className="field-input"
              placeholder={t("nav.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto px-0.5">
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-[12.5px] text-text-muted">
              {t("nav.noRecentTasks")}
            </div>
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

        <div className="mt-1 flex items-center gap-1 border-t border-border-subtle pt-1">
          <button
            className={`nav-item min-w-0 flex-1 ${page === "settings" ? "active" : ""}`}
            data-nav="settings"
            onClick={() => setPage("settings")}
          >
            <IconSettings size={15} />
            <span>{t("nav.custom")}</span>
          </button>
          <button
            className="icon-btn"
            title="Help / logs"
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
