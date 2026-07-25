import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { Badge, Panel } from "./ui";
import { IconClose } from "./icons";

export function ContextPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
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
        <div className="text-md-plus font-medium">{t("context.title")}</div>
        <button className="icon-btn" onClick={onClose} title={t("context.close")}>
          <IconClose size={15} />
        </button>
      </div>
      <div className="space-y-3 overflow-auto p-3">
        <Panel className="space-y-2 p-3">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t("context.workspace")}
          </div>
          <div className="text-md text-text-primary">
            {workspace?.path || t("context.noProject")}
          </div>
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t("context.model")}
          </div>
          <div className="text-md">{provider?.name || t("context.noProvider")}</div>
          <div className="font-mono text-xs-plus text-text-muted">
            {settings?.defaultModelId || provider?.defaultModelId || "—"}
          </div>
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t("context.status")}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={healthOk ? "success" : "error"}>
              {healthOk ? t("status.hostOk") : t("status.hostDown")}
            </Badge>
            <Badge tone={isRunning ? "warning" : "neutral"}>
              {isRunning ? t("context.running") : t("context.idle")}
            </Badge>
          </div>
          <div className="text-sm text-text-muted">
            {version?.name} {version?.version}
          </div>
        </Panel>
      </div>
    </aside>
  );
}
