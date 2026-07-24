import { useAppStore } from "../stores/app-store";
import { Button, Panel } from "../components/ui";
import { IconPullRequest } from "../components/icons";

export function PullRequestsPage() {
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const sendPrompt = useAppStore((s) => s.sendPrompt);

  return (
    <div className="thread-scroll">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <div className="mb-6">
          <div className="text-[20px] font-medium tracking-tight">Pull requests</div>
          <div className="mt-1 text-[13px] text-text-secondary">
            Review and act on pull requests in the active project.
          </div>
        </div>

        <Panel className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
            <IconPullRequest size={20} />
          </div>
          <div className="text-[15px] font-medium">No pull requests</div>
          <div className="mt-2 max-w-md text-[13px] text-text-secondary">
            {workspace?.path
              ? `No open pull requests detected for ${workspace.name}. Start a task to inspect git status, branches, or draft a PR.`
              : "Open a project first, then ask the agent to list or review pull requests."}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {!workspace?.path ? (
              <Button variant="primary" onClick={() => void openProject()}>
                Open project
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
                Review with agent
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
