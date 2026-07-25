import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectRecord } from "@pi-desktop/shared";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Button } from "../components/ui";
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconPlus,
  IconSearch,
} from "../components/icons";
import {
  loadRecentProjects,
  projectColor,
  rememberProject,
  type RecentProject,
} from "../lib/recent-projects";
import { collectSessionProjects } from "../lib/session-projects";
import {
  normalizeProjectPath,
  sessionMatchesProject,
} from "../lib/sidebar-session-groups";

function formatUpdated(ts?: number, locale?: string, neverLabel = "—") {
  if (!ts) return neverLabel;
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return neverLabel;
  }
}

function sourceLabel(path: string) {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const clearProject = useAppStore((s) => s.clearProject);
  const newSession = useAppStore((s) => s.newSession);
  const selectSession = useAppStore((s) => s.selectSession);
  const setPage = useAppStore((s) => s.setPage);
  const showToast = useAppStore((s) => s.showToast);
  const sessions = useAppStore((s) => s.sessions);
  const [recents, setRecents] = useState<RecentProject[]>(() => loadRecentProjects());
  const [durableProjects, setDurableProjects] = useState<ProjectRecord[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    void api
      .listProjects()
      .then(({ projects }) => {
        if (!canceled) setDurableProjects(projects);
      })
      .catch(() => {
        // Session-derived entries below keep the index useful if host listing fails.
      });
    return () => {
      canceled = true;
    };
  }, [sessions]);

  const items = useMemo(() => {
    const byPath = new Map<string, RecentProject>();
    for (const project of durableProjects) {
      const key = normalizeProjectPath(project.path);
      if (!key) continue;
      byPath.set(key, {
        path: project.path,
        name: project.name,
        openedAt: project.lastOpenedAt,
        pinned: project.pinned,
        color: projectColor(project.path),
      });
    }
    for (const project of recents) {
      const key = normalizeProjectPath(project.path);
      if (!key) continue;
      const existing = byPath.get(key);
      byPath.set(key, {
        ...existing,
        ...project,
        openedAt: Math.max(existing?.openedAt ?? 0, project.openedAt),
        pinned: project.pinned ?? existing?.pinned,
      });
    }
    for (const project of collectSessionProjects(sessions)) {
      const key = normalizeProjectPath(project.path);
      if (!key) continue;
      const existing = byPath.get(key);
      byPath.set(key, {
        path: existing?.path ?? project.path,
        name: existing?.name ?? project.name,
        branch: existing?.branch,
        openedAt: Math.max(existing?.openedAt ?? 0, project.updatedAt),
        pinned: existing?.pinned,
        color: existing?.color ?? projectColor(project.path),
      });
    }
    if (workspace?.path) {
      const key = normalizeProjectPath(workspace.path);
      const existing = key ? byPath.get(key) : undefined;
      if (key) {
        byPath.set(key, {
          path: workspace.path,
          name: workspace.name || existing?.name || workspace.path,
          branch: workspace.branch || existing?.branch,
          openedAt: Math.max(existing?.openedAt ?? 0, Date.now()),
          pinned: existing?.pinned,
          color: existing?.color ?? projectColor(workspace.path),
        });
      }
    }
    return [...byPath.values()].sort(
      (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.openedAt - a.openedAt,
    );
  }, [durableProjects, recents, sessions, workspace]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        (p.branch || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const activate = async (path: string) => {
    try {
      if (workspace?.path === path) {
        setPage("chat");
        return;
      }
      const result = await api.setProject(path);
      if (result.workspace?.path) {
        rememberProject({
          path: result.workspace.path,
          name: result.workspace.name || result.workspace.path,
          branch: result.workspace.branch,
        });
        useAppStore.setState({ workspace: result.workspace, page: "chat" });
        setRecents(loadRecentProjects());
      } else {
        await openProject();
        setRecents(loadRecentProjects());
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    }
  };

  const startTask = async (path: string) => {
    try {
      await activate(path);
      await newSession();
      setPage("chat");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    }
  };

  const openProjectSession = async (path: string, sessionId: string) => {
    await activate(path);
    if (
      normalizeProjectPath(useAppStore.getState().workspace?.path) !==
      normalizeProjectPath(path)
    ) {
      return;
    }
    try {
      await selectSession(sessionId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    }
  };

  return (
    <div className="thread-scroll">
      <div className="projects-index">
        <div className="projects-index-header">
          <h1 className="projects-index-title">{t("project.title")}</h1>
          <div className="projects-index-tools">
            <div className="projects-search-wrap">
              <IconSearch size={14} />
              <input
                className="projects-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("project.searchPlaceholder")}
                aria-label={t("project.searchPlaceholder")}
              />
            </div>
            <Button
              variant="primary"
              onClick={() => void openProject().then(() => setRecents(loadRecentProjects()))}
            >
              <IconPlus size={14} />
              {t("project.add")}
            </Button>
          </div>
        </div>

        <div className="projects-table" role="table" aria-label={t("project.title")}>
          <div className="projects-table-head" role="row">
            <div className="projects-col name" role="columnheader">
              {t("project.columnName")}
            </div>
            <div className="projects-col sources" role="columnheader">
              {t("project.columnWorkspace")}
            </div>
            <div className="projects-col updated" role="columnheader">
              {t("project.columnLastActive")}
            </div>
            <div className="projects-col actions" role="columnheader" />
          </div>

          {filtered.length === 0 ? (
            <div className="projects-empty">
              <div className="projects-empty-title">
                {items.length === 0
                  ? t("project.noProjects")
                  : t("project.noSearchResults")}
              </div>
              <div className="projects-empty-body">
                {items.length === 0
                  ? t("project.emptyIndexBody")
                  : t("project.noSearchResultsBody")}
              </div>
              {items.length === 0 ? (
                <Button
                  className="mt-4"
                  variant="primary"
                  onClick={() => void openProject().then(() => setRecents(loadRecentProjects()))}
                >
                  <IconPlus size={14} />
                  {t("project.add")}
                </Button>
              ) : null}
            </div>
          ) : (
            filtered.map((project) => {
              const active = workspace?.path === project.path;
              const color = project.color || projectColor(project.path);
              const isOpen = !!expanded[project.path];
              const related = sessions
                .filter((session) => sessionMatchesProject(session, project.path))
                .slice(0, 4);
              return (
                <div key={project.path} className={`projects-row-block ${active ? "active" : ""}`}>
                  <div className="projects-table-row" role="row">
                    <div className="projects-col name" role="cell">
                      <button
                        type="button"
                        className="projects-expand"
                        aria-label={t(
                          isOpen ? "project.collapseDetails" : "project.expandDetails",
                          { name: project.name },
                        )}
                        aria-expanded={isOpen}
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [project.path]: !prev[project.path] }))
                        }
                      >
                        {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </button>
                      <button
                        type="button"
                        className="projects-name-btn"
                        onClick={() => void activate(project.path)}
                        title={project.path}
                      >
                        <span className="projects-glyph" style={{ background: color }}>
                          <IconFolder size={14} />
                        </span>
                        <span className="projects-name-copy">
                          <span className="projects-name-title">
                            {project.name}
                            {project.pinned ? <span className="projects-pin-dot" /> : null}
                            {active ? (
                              <span className="projects-active-tag">{t("project.active")}</span>
                            ) : null}
                          </span>
                          <span className="projects-name-path">{project.path}</span>
                        </span>
                      </button>
                    </div>
                    <div className="projects-col sources" role="cell">
                      <span className="projects-source-chip" title={project.path}>
                        {sourceLabel(project.path)}
                      </span>
                      {project.branch ? (
                        <span className="projects-source-meta">{project.branch}</span>
                      ) : null}
                    </div>
                    <div className="projects-col updated" role="cell">
                      {formatUpdated(
                        project.openedAt,
                        i18n.resolvedLanguage || i18n.language,
                        t("project.updatedNever"),
                      )}
                    </div>
                    <div className="projects-col actions" role="cell">
                      <div className="projects-row-actions">
                        <div className="projects-menu-wrap">
                          <button
                            type="button"
                            className="projects-icon-btn"
                            aria-label={t("project.openActions", { name: project.name })}
                            title={t("project.openActions", { name: project.name })}
                            aria-haspopup="menu"
                            aria-expanded={menuFor === project.path}
                            onClick={() =>
                              setMenuFor((cur) => (cur === project.path ? null : project.path))
                            }
                          >
                            ···
                          </button>
                          {menuFor === project.path ? (
                            <div className="projects-menu" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuFor(null);
                                  void startTask(project.path);
                                }}
                              >
                                {t("project.newTask")}
                              </button>
                              {active ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={async () => {
                                    setMenuFor(null);
                                    await clearProject();
                                    setRecents(loadRecentProjects());
                                  }}
                                >
                                  {t("project.close")}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="projects-row-detail">
                      <div className="projects-detail-label">{t("project.newTask")}</div>
                      <div className="projects-detail-actions">
                        <Button size="sm" variant="secondary" onClick={() => void startTask(project.path)}>
                          {t("project.newTask")}
                        </Button>
                      </div>
                      <div className="projects-detail-label">{t("project.sessions")}</div>
                      {related.length === 0 ? (
                        <div className="projects-detail-empty">{t("project.noSessions")}</div>
                      ) : (
                        <div className="projects-detail-tasks">
                          {related.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="projects-detail-task"
                              onClick={() => void openProjectSession(project.path, s.id)}
                            >
                              {s.title || s.id}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
