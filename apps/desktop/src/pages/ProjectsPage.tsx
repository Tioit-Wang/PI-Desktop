import { useAppStore } from "../stores/app-store";
import { Button, Panel } from "../components/ui";
import { IconFolder, IconPlus } from "../components/icons";

export function ProjectsPage() {
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);
  const clearProject = useAppStore((s) => s.clearProject);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="thread-scroll">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-[20px] font-medium tracking-tight">Projects</div>
            <div className="mt-1 text-[13px] text-text-secondary">
              Open a local folder as the active coding workspace.
            </div>
          </div>
          <Button variant="primary" onClick={() => void openProject()}>
            <IconPlus size={14} />
            Add project
          </Button>
        </div>

        {workspace?.path ? (
          <Panel className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[13px] text-text-muted">
                  <IconFolder size={14} />
                  Active project
                </div>
                <div className="truncate text-[16px] font-medium">{workspace.name}</div>
                <div className="mt-1 truncate font-mono text-[12px] text-text-muted">
                  {workspace.path}
                </div>
                <div className="mt-2 text-[12px] text-text-secondary">
                  Branch: {workspace.branch || "—"}
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
                  New task
                </Button>
                <Button variant="ghost" onClick={() => void openProject()}>
                  Switch
                </Button>
                <Button variant="ghost" onClick={() => void clearProject()}>
                  Close
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
              <IconFolder size={20} />
            </div>
            <div className="text-[15px] font-medium">No projects</div>
            <div className="mt-2 max-w-md text-[13px] text-text-secondary">
              Add a local project folder to ground tools, composer context, and the home hero
              in a real workspace.
            </div>
            <Button className="mt-5" variant="primary" onClick={() => void openProject()}>
              Add project
            </Button>
          </Panel>
        )}
      </div>
    </div>
  );
}
