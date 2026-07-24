import { useAppStore } from "../stores/app-store";

export function PermissionDialog() {
  const permission = useAppStore((s) => s.permission);
  const resolvePermission = useAppStore((s) => s.resolvePermission);
  if (!permission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-1 text-xs uppercase tracking-wide text-amber-400">
          {permission.risk} risk
        </div>
        <h2 className="mb-2 text-lg font-semibold text-slate-50">
          Permission required
        </h2>
        <p className="mb-3 text-sm text-slate-300">{permission.reason}</p>
        <div className="mb-2 text-sm text-slate-400">
          Tool: <span className="text-slate-200">{permission.toolName}</span>
        </div>
        <pre className="mb-4 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
          {JSON.stringify(permission.argsPreview, null, 2)}
        </pre>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => void resolvePermission("deny")}
          >
            Deny
          </button>
          <button
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => void resolvePermission("allow-session")}
          >
            Allow for session
          </button>
          <button
            className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400"
            onClick={() => void resolvePermission("allow-once")}
          >
            Allow once
          </button>
        </div>
      </div>
    </div>
  );
}
