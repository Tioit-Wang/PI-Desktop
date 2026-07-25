import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { Button, Panel } from "../components/ui";
import { IconFolder, IconPlus } from "../components/icons";
import {
  loadRecentProjects,
  projectColor,
  removeRecentProject,
  setProjectPinned,
  type RecentProject,
} from "../lib/recent-projects";

export function ProjectsPage() {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const clearProject = useAppStore((s) => s.clearProject);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const setToast = useAppStore((s) => s.setToast);
  const [recents, setRecents] = useState<RecentProject[]>(() => loadRecentProjects());

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

  const activate = async (path: string) => {
    try {
      // Prefer native open dialog for new paths; for recents re-open via host if supported.
      // Fallback: if already active, go home; else open dialog.
      if (workspace?.path === path) {
        setPage("chat");
        return;
      }
      await openProject();
      setRecents(loadRecentProjects());
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="thread-scroll">
      <div className="page-frame">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t("project.title")}</h1>
            <div className="page-subtitle">{t("project.subtitle")}</div>
          </div>
          <Button variant="primary" onClick={() => void openProject().then(() => setRecents(loadRecentProjects()))}>
            <IconPlus size={14} />
            {t("project.add")}
          </Button>
        </div>

        {items.length === 0 ? (
          <Panel className="page-card page-empty">
            <div className="page-empty-icon">
              <IconFolder size={20} />
            </div>
            <div className="text-[15px] font-medium">{t("project.emptyTitle")}</div>
            <div className="mt-2 max-w-md text-[13px] text-text-secondary">
              {t("project.emptyBody")}
            </div>
            <Button className="mt-5" variant="primary" onClick={() => void openProject()}>
              {t("project.add")}
            </Button>
          </Panel>
        ) : (
          <div className="project-grid">
            {items.map((project) => {
              const active = workspace?.path === project.path;
              const color = project.color || projectColor(project.path);
              return (
                <Panel
                  key={project.path}
                  className={`project-card ${active ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="project-card-main"
                    onClick={() => void activate(project.path)}
                    title={project.path}
                  >
                    <span className="project-glyph" style={{ background: color }}>
                      <IconFolder size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[14px] font-medium text-text-primary">
                        {project.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11.5px] text-text-muted">
                        {project.path}
                      </span>
                      {(project.branch || (active && workspace?.branch)) && (
                        <span className="mt-1 block text-[11.5px] text-text-secondary">
                          {t("project.branch")}: {active ? workspace?.branch || project.branch : project.branch}
                        </span>
                      )}
                    </span>
                    {active && <span className="project-active-pill">{t("project.active")}</span>}
                  </button>
                  <div className="project-card-actions">
                    <button
                      type="button"
                      className="project-action"
                      onClick={() => setRecents(setProjectPinned(project.path, !project.pinned))}
                    >
                      {project.pinned ? t("project.unpin") : t("project.pin")}
                    </button>
                    {active ? (
                      <>
                        <button
                          type="button"
                          className="project-action"
                          onClick={async () => {
                            await newSession();
                            setPage("chat");
                          }}
                        >
                          {t("nav.newTask")}
                        </button>
                        <button
                          type="button"
                          className="project-action"
                          onClick={async () => {
                            await clearProject();
                            setRecents(loadRecentProjects());
                          }}
                        >
                          {t("project.close")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="project-action danger"
                        onClick={() => setRecents(removeRecentProject(project.path))}
                      >
                        {t("project.remove")}
                      </button>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
