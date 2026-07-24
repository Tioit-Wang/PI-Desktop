import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Badge, Button, Panel } from "../components/ui";
import { IconAt } from "../components/icons";

export function PluginsPage() {
  const { t } = useTranslation();
  const plugins = useAppStore((s) => s.plugins);
  const refreshPlugins = useAppStore((s) => s.refreshPlugins);
  const setToast = useAppStore((s) => s.setToast);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="thread-scroll">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-[20px] font-medium tracking-tight">{t("plugins.title")}</div>
            <div className="mt-1 text-[13px] text-text-secondary">{t("plugins.subtitle")}</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await api.loadDevPlugin();
                  await refreshPlugins();
                  setToast(t("plugins.loadDev"));
                } catch (e) {
                  setToast(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              {t("plugins.loadDev")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSettingsTab("plugins");
                setPage("settings");
              }}
            >
              {t("nav.settings")}
            </Button>
          </div>
        </div>

        {plugins.length === 0 ? (
          <Panel className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
              <IconAt size={20} />
            </div>
            <div className="text-[15px] font-medium">{t("plugins.empty")}</div>
            <div className="mt-2 max-w-md text-[13px] text-text-secondary">
              {t("plugins.emptyBody")}
            </div>
          </Panel>
        ) : (
          <div className="space-y-2">
            {plugins.map((plugin) => (
              <Panel key={plugin.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium">{plugin.name}</div>
                  <div className="truncate text-[12px] text-text-muted">
                    {plugin.id} · {plugin.version || "dev"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={plugin.enabled ? "success" : "neutral"}>
                    {plugin.enabled ? t("plugins.enable") : t("plugins.disable")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (plugin.enabled) await api.disablePlugin(plugin.id);
                      else await api.enablePlugin(plugin.id);
                      await refreshPlugins();
                    }}
                  >
                    {plugin.enabled ? t("plugins.disable") : t("plugins.enable")}
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
