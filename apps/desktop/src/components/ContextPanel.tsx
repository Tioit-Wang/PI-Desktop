import { useAppStore } from "../stores/app-store";
import { Badge, Panel } from "./ui";
import { IconClose } from "./icons";

export function ContextPanel({ onClose }: { onClose: () => void }) {
  const workspace = useAppStore((s) => s.workspace);
  const settings = useAppStore((s) => s.settings);
  const providers = useAppStore((s) => s.providers);
  const version = useAppStore((s) => s.version);
  const healthOk = useAppStore((s) => s.healthOk);
  const isRunning = useAppStore((s) => s.isRunning);

  const provider = providers.find((p) => p.id === settings?.defaultProviderId);

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-[300px] flex-col border-l border-border-subtle bg-bg-primary shadow-[var(--ds-shadow-dialog)]">
      <div className="flex h-[46px] items-center justify-between border-b border-border-subtle px-3">
        <div className="text-[13.5px] font-medium">Context</div>
        <button className="icon-btn" onClick={onClose} title="Close">
          <IconClose size={15} />
        </button>
      </div>
      <div className="space-y-3 overflow-auto p-3">
        <Panel className="space-y-2 p-3">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">Workspace</div>
          <div className="text-[13px] text-text-primary">
            {workspace?.path || "No project open"}
          </div>
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">Model</div>
          <div className="text-[13px]">{provider?.name || "No provider"}</div>
          <div className="font-mono text-[11.5px] text-text-muted">
            {settings?.defaultModelId || provider?.defaultModelId || "—"}
          </div>
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">Status</div>
          <div className="flex items-center gap-2">
            <Badge tone={healthOk ? "success" : "error"}>
              {healthOk ? "Host ready" : "Host down"}
            </Badge>
            <Badge tone={isRunning ? "warning" : "neutral"}>
              {isRunning ? "Running" : "Idle"}
            </Badge>
          </div>
          <div className="text-[12px] text-text-muted">
            {version?.name} {version?.version}
          </div>
        </Panel>
      </div>
    </aside>
  );
}
