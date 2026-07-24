import { useAppStore } from "../stores/app-store";

export function OnboardingChecklist() {
  const onboarding = useAppStore((s) => s.onboarding);
  const setPage = useAppStore((s) => s.setPage);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const openProject = useAppStore((s) => s.openProject);

  if (!onboarding?.showChecklist) return null;

  return (
    <div className="mx-6 mt-4 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-100">Get started</div>
      <div className="space-y-2">
        {onboarding.steps.map((step) => (
          <button
            key={step.id}
            className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-left text-sm hover:bg-slate-800/60"
            onClick={() => {
              if (step.action === "settings.providers") {
                setSettingsTab("providers");
              } else if (step.action === "settings.plugins") {
                setSettingsTab("plugins");
              } else if (step.action === "project.open") {
                void openProject();
              } else {
                setPage("chat");
              }
            }}
          >
            <span className={step.done ? "text-slate-500 line-through" : "text-slate-200"}>
              {step.title}
            </span>
            <span
              className={`text-xs ${step.done ? "text-green-400" : "text-slate-500"}`}
            >
              {step.done ? "Done" : "Todo"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
