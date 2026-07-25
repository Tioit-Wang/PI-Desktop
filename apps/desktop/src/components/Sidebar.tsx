import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDefaultSessionTitle, useAppStore } from "../stores/app-store";
import { groupSidebarSessions, normalizeProjectPath } from "../lib/sidebar-session-groups";
import {
  IconAt,
  IconChevronLeft,
  IconChevronRight,
  IconCompose,
  IconFolder,
  IconCloudDown,
  IconHelp,
  IconGear,
  IconPanel,
  IconPlus,
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
  const openProject = useAppStore((s) => s.openProject);
  const clearProject = useAppStore((s) => s.clearProject);
  const workspace = useAppStore((s) => s.workspace);
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
    return isDefaultSessionTitle(value) ? t("chat.untitledTask") : value;
  };

  const filtered = useMemo(() => {
    // Keep at most one empty draft in each project/temporary scope.
    const keptEmptyScopes = new Set<string>();
    const cleaned: typeof sessions = [];
    for (const s of sessions) {
      if (!isDefaultSessionTitle(s.title)) {
        cleaned.push(s);
        continue;
      }
      const scope = normalizeProjectPath(s.projectPath) ?? "(temporary)";
      if (s.id === activeSessionId && page === "chat") {
        if (!keptEmptyScopes.has(scope)) cleaned.push(s);
        keptEmptyScopes.add(scope);
        continue;
      }
      if (keptEmptyScopes.has(scope)) continue;
      cleaned.push(s);
      keptEmptyScopes.add(scope);
    }
    const q = query.trim().toLowerCase();
    if (!q) return cleaned;
    return cleaned.filter((s) => taskTitle(s.title).toLowerCase().includes(q));
  }, [sessions, query, t, activeSessionId, page]);

  const { projectSessions, temporarySessions } = useMemo(
    () => groupSidebarSessions(filtered, workspace?.path),
    [filtered, workspace?.path],
  );

  const selectTemporarySession = async (sessionId: string) => {
    if (workspace) await clearProject();
    await selectSession(sessionId);
  };

  const renderSessionRows = (
    items: typeof sessions,
    options?: { temporary?: boolean },
  ) =>
    items.map((session) => {
      const active = page === "chat" && activeSessionId === session.id;
      return (
        <div key={session.id} className={`thread-item ${active ? "active" : ""}`}>
          <button
            type="button"
            className="thread-item-main"
            onClick={() =>
              void (options?.temporary
                ? selectTemporarySession(session.id)
                : selectSession(session.id))
            }
            title={taskTitle(session.title)}
            aria-current={active ? "page" : undefined}
          >
            <span className="thread-item-title">{taskTitle(session.title)}</span>
          </button>
        </div>
      );
    });

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
            title={t("nav.back")}
            disabled={!canBack}
            onClick={() => navBack()}
          >
            <IconChevronLeft size={13} />
          </button>
          <button
            className="title-nav-btn"
            title={t("nav.forward")}
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
            className={`nav-item ${page === "plugins" ? "active" : ""}`}
            data-nav="plugins"
            onClick={() => setPage("plugins")}
          >
            <IconAt size={15} />
            <span>{t("nav.plugins")}</span>
          </button>
        </nav>

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

        <div className="sidebar-session-groups min-h-0 flex-1 overflow-auto px-0.5">
          <section
            className="sidebar-session-group"
            aria-labelledby="sidebar-project-group-label"
          >
            <div className="sidebar-session-group-header">
              {workspace ? (
                <button
                  type="button"
                  id="sidebar-project-group-label"
                  className="sidebar-session-group-title"
                  title={workspace.path}
                  onClick={() => setPage("projects")}
                >
                  <IconFolder size={13} />
                  <span>{workspace.name || workspace.path}</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="sidebar-project-group-label"
                  className="sidebar-session-group-title"
                  onClick={() => void openProject()}
                >
                  <IconFolder size={13} />
                  <span>{t("project.open")}</span>
                </button>
              )}
              {workspace ? (
                <button
                  type="button"
                  className="sidebar-session-group-add"
                  title={t("project.newTask")}
                  aria-label={t("project.newTask")}
                  onClick={() => void newSession({ projectPath: workspace.path })}
                >
                  <IconPlus size={13} />
                </button>
              ) : null}
            </div>
            {workspace ? (
              <div className="sidebar-session-group-body project">
                {projectSessions.length > 0 ? (
                  renderSessionRows(projectSessions)
                ) : (
                  <div className="sidebar-session-empty">{t("nav.noProjectSessions")}</div>
                )}
              </div>
            ) : null}
          </section>

          <section
            className="sidebar-session-group"
            aria-labelledby="sidebar-temporary-group-label"
          >
            <div className="sidebar-session-group-header">
              <div
                id="sidebar-temporary-group-label"
                className="sidebar-session-group-title static"
              >
                <IconPanel size={13} />
                <span>{t("nav.temporarySessions")}</span>
              </div>
              <button
                type="button"
                className="sidebar-session-group-add"
                title={t("nav.newTemporarySession")}
                aria-label={t("nav.newTemporarySession")}
                onClick={() => void newSession({ projectPath: null })}
              >
                <IconPlus size={13} />
              </button>
            </div>
            <div className="sidebar-session-group-body temporary">
              {temporarySessions.length > 0 ? (
                renderSessionRows(temporarySessions, { temporary: true })
              ) : (
                <div className="sidebar-session-empty">{t("nav.noTemporarySessions")}</div>
              )}
            </div>
          </section>
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
            <IconGear size={15} />
            <span className="truncate">{t("nav.custom")}</span>
          </button>
          <button
            className="footer-help"
            title={t("nav.help")}
            aria-label={t("nav.help")}
            onClick={() => setPage("settings")}
          >
            <IconHelp size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
