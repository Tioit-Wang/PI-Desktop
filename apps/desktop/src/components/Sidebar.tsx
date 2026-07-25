import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import {
  IconAt,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCompose,
  IconFolder,
  IconCloudDown,
  IconHelp,
  IconPullRequest,
  IconSearch,
  IconSettings,
  IconSliders,
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
  const settings = useAppStore((s) => s.settings);
  const page = useAppStore((s) => s.page);
  const navBack = useAppStore((s) => s.navBack);
  const navForward = useAppStore((s) => s.navForward);
  const navIndex = useAppStore((s) => s.navIndex);
  const navStack = useAppStore((s) => s.navStack);
  const canBack = navIndex > 0;
  const canForward = navIndex < navStack.length - 1;
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

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
    const isDefaultTitle = (title?: string | null) => {
      const value = (title || "").trim();
      return (
        !value ||
        value.toLowerCase() === "new task" ||
        value.toLowerCase() === "new chat" ||
        value === "新建任务"
      );
    };
    // Keep one empty draft max (active preferred), hide the rest like Codex Recents.
    let keptEmpty = false;
    const cleaned: typeof sessions = [];
    for (const s of sessions) {
      if (!isDefaultTitle(s.title)) {
        cleaned.push(s);
        continue;
      }
      if (s.id === activeSessionId && page === "chat") {
        if (!keptEmpty) cleaned.push(s);
        keptEmpty = true;
        continue;
      }
      if (keptEmpty) continue;
      cleaned.push(s);
      keptEmpty = true;
    }
    const q = query.trim().toLowerCase();
    if (!q) return cleaned;
    return cleaned.filter((s) => taskTitle(s.title).toLowerCase().includes(q));
  }, [sessions, query, t, activeSessionId, page]);

  if (collapsed) {
    return (
      <aside className="sidebar-rail">
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
            title={t("nav.settings")}
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
      <div className="sidebar-drag">
        <div className="traffic-nav no-drag">
          <button
            className="title-nav-btn"
            title="Back"
            disabled={!canBack}
            onClick={() => navBack()}
          >
            <IconChevronLeft size={13} />
          </button>
          <button
            className="title-nav-btn"
            title="Forward"
            disabled={!canForward}
            onClick={() => navForward()}
          >
            <IconChevronRight size={13} />
          </button>
        </div>
      </div>
      <div className="no-drag flex min-h-0 flex-1 flex-col px-2 pb-1.5">
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
          className="nav-item new-task-btn mb-1"
          data-nav="new-task"
          onClick={() => void newSession()}
        >
          <IconCompose size={15} />
          <span>{t("nav.newTask")}</span>
        </button>

        <nav className="mb-0.5 space-y-0 px-0.5">
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

        <div className="sidebar-recents min-h-0 flex-1 overflow-auto px-0.5">
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

        <div className="sidebar-footer no-drag" ref={profileRef}>
          {profileOpen && (
            <div className="profile-menu" role="menu">
              <button
                className="profile-menu-item"
                role="menuitem"
                data-nav="settings"
                onClick={() => {
                  setProfileOpen(false);
                  setPage("settings");
                }}
              >
                <IconSettings size={15} />
                <span>{t("nav.settings")}</span>
              </button>
              <button
                className="profile-menu-item"
                role="menuitem"
                onClick={async () => {
                  setProfileOpen(false);
                  try {
                    await (await import("../lib/api")).api.openLogs();
                  } catch {
                    // ignore
                  }
                }}
              >
                <IconCloudDown size={15} />
                <span>{t("nav.profileLogs")}</span>
              </button>
              <button
                className="profile-menu-item"
                role="menuitem"
                onClick={async () => {
                  setProfileOpen(false);
                  const cur = useAppStore.getState().settings;
                  if (!cur) return;
                  const order = ["system", "light", "dark"] as const;
                  const idx = order.indexOf((cur.theme as (typeof order)[number]) || "system");
                  const theme = order[(idx + 1) % order.length];
                  try {
                    await (await import("../lib/api")).api.setSettings({ ...cur, theme });
                    // store refresh via host settings event path
                    useAppStore.setState({ settings: { ...cur, theme } });
                  } catch {
                    // ignore
                  }
                }}
              >
                <IconSliders size={15} />
                <span>{t("nav.profileTheme")}</span>
                <span className="meta">{settings?.theme || "system"}</span>
              </button>
            </div>
          )}
          <button
            className={`nav-item footer-profile ${page === "settings" || profileOpen ? "active" : ""}`}
            data-nav="profile"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
            title={t("nav.openProfileMenu")}
          >
            <span className="footer-avatar" aria-hidden>
              C
            </span>
            <span className="truncate">{t("nav.custom")}</span>
          </button>
          <button
            className="footer-badge"
            title="Updates / cloud"
            aria-label="Updates"
            onClick={async () => {
              // Codex sidebarFooter cloud/update control; open logs as local stand-in.
              try {
                await (await import("../lib/api")).api.openLogs();
              } catch {
                // ignore
              }
            }}
          >
            <IconCloudDown size={11} />
          </button>
        </div>
      </div>
    </aside>
  );
}
