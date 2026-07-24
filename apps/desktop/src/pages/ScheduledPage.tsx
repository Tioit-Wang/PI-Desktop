import { useAppStore } from "../stores/app-store";
import { Button, Panel } from "../components/ui";
import { IconClock } from "../components/icons";

export function ScheduledPage() {
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const setToast = useAppStore((s) => s.setToast);

  return (
    <div className="thread-scroll">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-[20px] font-medium tracking-tight">Scheduled</div>
            <div className="mt-1 text-[13px] text-text-secondary">
              Automations and recurring tasks.
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await newSession();
              setPage("chat");
              setToast("Describe the automation you want in the new task");
            }}
          >
            Create task
          </Button>
        </div>

        <Panel className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
            <IconClock size={20} />
          </div>
          <div className="text-[15px] font-medium">No scheduled tasks</div>
          <div className="mt-2 max-w-md text-[13px] text-text-secondary">
            Create a task to draft an automation. Hosted schedule runners are not enabled in this
            build; the agent can still design the workflow and scripts.
          </div>
          <Button
            className="mt-5"
            variant="primary"
            onClick={async () => {
              await newSession();
              setPage("chat");
            }}
          >
            Create task
          </Button>
        </Panel>
      </div>
    </div>
  );
}
