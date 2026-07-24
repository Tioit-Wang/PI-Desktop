import { useAppStore } from "../stores/app-store";

export function Sidebar() {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const newSession = useAppStore((s) => s.newSession);
  const selectSession = useAppStore((s) => s.selectSession);
  const setPage = useAppStore((s) => s.setPage);
  const workspace = useAppStore((s) => s.workspace);
  const openProject = useAppStore((s) => s.openProject);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/80">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-100">
            PI-Desktop
          </div>
          <div className="text-xs text-slate-500">Local coding agent</div>
        </div>
        <button
          className="rounded-md bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-400"
          onClick={() => void newSession()}
        >
          New
        </button>
      </div>

      <button
        className="mx-3 mt-3 rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700"
        onClick={() => void openProject()}
      >
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          Project
        </div>
        <div className="truncate">{workspace?.name ?? "Open project…"}</div>
      </button>

      <div className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Sessions
      </div>
      <div className="flex-1 overflow-auto px-2 py-2">
        {sessions.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-slate-500">
            No sessions yet
          </div>
        )}
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => void selectSession(session.id)}
            className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm ${
              session.id === activeSessionId
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <div className="truncate font-medium">{session.title}</div>
            <div className="truncate text-[11px] text-slate-500">
              {new Date(session.updatedAt).toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      <div className="border-t border-slate-800 p-3">
        <button
          className="w-full rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          onClick={() => setPage("settings")}
        >
          Settings
        </button>
      </div>
    </aside>
  );
}
