import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PullRequestSummary } from "@pi-desktop/shared";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Badge, Button, Panel } from "../components/ui";
import { IconExternal, IconPullRequest } from "../components/icons";

export function PullRequestsPage() {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const sendPrompt = useAppStore((s) => s.sendPrompt);
  const [pulls, setPulls] = useState<PullRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.listPullRequests();
      setPulls(res.pulls || []);
      setError(res.error || null);
    } catch (e) {
      setPulls([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspace?.path]);

  return (
    <div className="thread-scroll">
      <div className="page-frame">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t("pulls.title")}</h1>
            <div className="page-subtitle">{t("pulls.subtitle")}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={loading} onClick={() => void refresh()}>
              {loading ? "…" : t("pulls.refresh")}
            </Button>
            {workspace?.path ? (
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
            ) : null}
          </div>
        </div>

        {!workspace?.path ? (
          <Panel className="page-card page-empty">
            <div className="page-empty-icon">
              <IconPullRequest size={20} />
            </div>
            <div className="text-[15px] font-medium">{t("pulls.emptyTitle")}</div>
            <div className="mt-2 max-w-md text-[13px] text-text-secondary">
              {t("pulls.emptyBody")}
            </div>
            <Button className="mt-5" variant="primary" onClick={() => void openProject()}>
              {t("project.open")}
            </Button>
          </Panel>
        ) : pulls.length === 0 ? (
          <Panel className="page-card page-empty">
            <div className="page-empty-icon">
              <IconPullRequest size={20} />
            </div>
            <div className="text-[15px] font-medium">{t("pulls.emptyTitle")}</div>
            <div className="mt-2 max-w-md text-[13px] text-text-secondary">
              {error && error !== "NO_WORKSPACE"
                ? error
                : t("pulls.emptyBodyWithProject", { project: workspace.name })}
            </div>
          </Panel>
        ) : (
          <div className="space-y-2">
            {pulls.map((pr) => (
              <Panel key={pr.number} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-text-muted">#{pr.number}</span>
                      <div className="truncate text-[13.5px] font-medium">{pr.title}</div>
                      {pr.isDraft ? <Badge tone="warning">draft</Badge> : null}
                    </div>
                    <div className="mt-1 text-[12px] text-text-secondary">
                      {[pr.author, pr.headRefName && pr.baseRefName ? `${pr.headRefName} → ${pr.baseRefName}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <a
                    className="icon-btn no-underline"
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    title={pr.url}
                    onClick={(e) => {
                      // Electron may not open external by default; use shell via window open
                      e.preventDefault();
                      window.open(pr.url, "_blank");
                    }}
                  >
                    <IconExternal size={15} />
                  </a>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
