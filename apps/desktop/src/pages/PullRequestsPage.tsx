import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { Button, Panel } from "../components/ui";
import { IconPullRequest } from "../components/icons";

export function PullRequestsPage() {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const sendPrompt = useAppStore((s) => s.sendPrompt);

  return (
    <div className="thread-scroll">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <div className="mb-6">
          <div className="text-[20px] font-medium tracking-tight">{t("pulls.title")}</div>
          <div className="mt-1 text-[13px] text-text-secondary">{t("pulls.subtitle")}</div>
        </div>

        <Panel className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
            <IconPullRequest size={20} />
          </div>
          <div className="text-[15px] font-medium">{t("pulls.emptyTitle")}</div>
          <div className="mt-2 max-w-md text-[13px] text-text-secondary">
            {workspace?.path
              ? t("pulls.emptyBodyWithProject", { project: workspace.name })
              : t("pulls.emptyBody")}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {!workspace?.path ? (
              <Button variant="primary" onClick={() => void openProject()}>
                {t("project.open")}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={async () => {
                  await newSession();
                  setPage("chat");
                  await sendPrompt(
                    "List open pull requests and current branch status for this repository. Summarize what needs review.",
                  );
                }}
              >
                {t("pulls.review")}
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
