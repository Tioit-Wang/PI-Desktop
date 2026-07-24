import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { Button, Panel } from "../components/ui";
import { IconFolder, IconPlus } from "../components/icons";

export function ProjectsPage() {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const clearProject = useAppStore((s) => s.clearProject);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="thread-scroll">
      <div className="page-frame">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t("project.title")}</h1>
            <div className="page-subtitle">{t("project.subtitle")}</div>
          </div>
          <Button variant="primary" onClick={() => void openProject()}>
            <IconPlus size={14} />
            {t("project.add")}
          </Button>
        </div>

        {workspace?.path ? (
          <Panel className="page-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[13px] text-text-muted">
                  <IconFolder size={14} />
                  {t("project.active")}
                </div>
                <div className="truncate text-[16px] font-medium">{workspace.name}</div>
                <div className="mt-1 truncate font-mono text-[12px] text-text-muted">
                  {workspace.path}
                </div>
                <div className="mt-2 text-[12px] text-text-secondary">
                  {t("project.branch")}: {workspace.branch || "—"}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await newSession();
                    setPage("chat");
                  }}
                >
                  {t("nav.newTask")}
                </Button>
                <Button variant="ghost" onClick={() => void openProject()}>
                  {t("project.switch")}
                </Button>
                <Button variant="ghost" onClick={() => void clearProject()}>
                  {t("project.close")}
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
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
        )}
      </div>
    </div>
  );
}
