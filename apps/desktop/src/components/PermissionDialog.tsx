import { useAppStore } from "../stores/app-store";
import { Button } from "./ui";

export function PermissionDialog() {
  const permission = useAppStore((s) => s.permission);
  const resolvePermission = useAppStore((s) => s.resolvePermission);
  if (!permission) return null;

  return (
    <div className="overlay">
      <div className="dialog">
        <div className="mb-1 text-[15px] font-medium">Tool permission</div>
        <div className="mb-1 text-[13px] text-text-secondary">
          Allow <span className="text-text-primary">{permission.toolName}</span> to run?
        </div>
        {permission.reason ? (
          <div className="mb-3 text-[12px] text-text-muted">{permission.reason}</div>
        ) : null}
        <pre className="mb-4 max-h-40 overflow-auto rounded-[12px] border border-border-subtle bg-bg-inset p-3 font-mono text-[11.5px] text-text-secondary">
          {JSON.stringify(permission.argsPreview, null, 2)}
        </pre>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => void resolvePermission("deny")}>
            Deny
          </Button>
          <Button variant="secondary" onClick={() => void resolvePermission("allow-once")}>
            Allow once
          </Button>
          <Button variant="primary" onClick={() => void resolvePermission("allow-session")}>
            Allow for session
          </Button>
        </div>
      </div>
    </div>
  );
}
