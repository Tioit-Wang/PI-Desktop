import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  removeRecentProject,
  setProjectPinned,
  type RecentProject,
} from "../lib/recent-projects";

function formatUpdated(ts?: number, neverLabel = "—") {
  if (!ts) return neverLabel;
  try {
    return new Intl.DateTimeFormat(undefined, {
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
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const clearProject = useAppStore((s) => s.clearProject);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const setToast = useAppStore((s) => s.setToast);
  const sessions = useAppStore((s) => s.sessions);
  const [recents, setRecents] = useState<RecentProject[]>(() => loadRecentProjects());
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const items = useMemo(() => {
    const list = [...recents];
    if (workspace?.path && !list.some((p) => p.path === workspace.path)) {
      list.unshift({
        path: workspace.path,
        name: workspace.name || workspace.path,
        branch: workspace.branch || undefined,
        openedAt: Date.now(),
        color: projectColor(workspace.path),
      });
    }
    return list.sort(
      (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.openedAt - a.openedAt,
    );
  }, [recents, workspace]);

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
      setToast(e instanceof Error ? e.message : String(e));
    }
  };

  const startTask = async (path: string) => {
    try {
      await activate(path);
      await newSession();
      setPage("chat");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
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
              {t("project.new")}
            </Button>
          </div>
        </div>

        <div className="projects-table" role="table" aria-label={t("project.title")}>
          <div className="projects-table-head" role="row">
            <div className="projects-col name" role="columnheader">
              {t("project.columnName")}
            </div>
            <div className="projects-col sources" role="columnheader">
              {t("project.columnSources")}
            </div>
            <div className="projects-col updated" role="columnheader">
              {t("project.columnUpdated")}
            </div>
            <div className="projects-col actions" role="columnheader" />
          </div>

          {filtered.length === 0 ? (
            <div className="projects-empty">
              <div className="projects-empty-title">
                {items.length === 0 ? t("project.noProjects") : t("project.emptyTitle")}
              </div>
              <div className="projects-empty-body">{t("project.emptyIndexBody")}</div>
              <Button
                className="mt-4"
                variant="primary"
                onClick={() => void openProject().then(() => setRecents(loadRecentProjects()))}
              >
                <IconPlus size={14} />
                {t("project.new")}
              </Button>
            </div>
          ) : (
            filtered.map((project) => {
              const active = workspace?.path === project.path;
              const color = project.color || projectColor(project.path);
              const isOpen = !!expanded[project.path];
              const related = sessions
                .filter((s) => (s.title || "").toLowerCase().includes(project.name.toLowerCase()))
                .slice(0, 4);
              return (
                <div key={project.path} className={`projects-row-block ${active ? "active" : ""}`}>
                  <div className="projects-table-row" role="row">
                    <div className="projects-col name" role="cell">
                      <button
                        type="button"
                        className="projects-expand"
                        aria-label={t("project.title")}
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
                      {formatUpdated(project.openedAt, t("project.updatedNever"))}
                    </div>
                    <div className="projects-col actions" role="cell">
                      <div className="projects-row-actions">
                        <button
                          type="button"
                          className="projects-icon-btn"
                          title={project.pinned ? t("project.unpin") : t("project.pin")}
                          onClick={() =>
                            setRecents(setProjectPinned(project.path, !project.pinned))
                          }
                        >
                          {project.pinned ? "★" : "☆"}
                        </button>
                        <div className="projects-menu-wrap">
                          <button
                            type="button"
                            className="projects-icon-btn"
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
                                {t("project.startTask")}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuFor(null);
                                  setRecents(setProjectPinned(project.path, !project.pinned));
                                }}
                              >
                                {project.pinned ? t("project.unpin") : t("project.pin")}
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
                              ) : (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="danger"
                                  onClick={() => {
                                    setMenuFor(null);
                                    setRecents(removeRecentProject(project.path));
                                  }}
                                >
                                  {t("project.remove")}
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="projects-row-detail">
                      <div className="projects-detail-label">{t("project.startTask")}</div>
                      <div className="projects-detail-actions">
                        <Button size="sm" variant="secondary" onClick={() => void startTask(project.path)}>
                          {t("nav.newTask")}
                        </Button>
                      </div>
                      <div className="projects-detail-label">{t("nav.recents")}</div>
                      {related.length === 0 ? (
                        <div className="projects-detail-empty">{t("nav.noRecentTasks")}</div>
                      ) : (
                        <div className="projects-detail-tasks">
                          {related.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="projects-detail-task"
                              onClick={() => {
                                void useAppStore.getState().selectSession(s.id);
                                setPage("chat");
                              }}
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
