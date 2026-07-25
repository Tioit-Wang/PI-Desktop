import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Badge, Button, Panel } from "../components/ui";
import { IconAt } from "../components/icons";

export function PluginsPage() {
  const { t } = useTranslation();
  const plugins = useAppStore((s) => s.plugins);
  const refreshPlugins = useAppStore((s) => s.refreshPlugins);
  const showToast = useAppStore((s) => s.showToast);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="thread-scroll">
      <div className="page-frame">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t("plugins.title")}</h1>
            <div className="page-subtitle">{t("plugins.subtitle")}</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await api.loadDevPlugin();
                  await refreshPlugins();
                  showToast(t("plugins.loadDev"), { variant: "success" });
                } catch (e) {
                  showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
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
          <Panel className="page-card page-empty">
            <div className="page-empty-icon">
              <IconAt size={20} />
            </div>
            <div className="text-base-plus font-medium">{t("plugins.empty")}</div>
            <div className="mt-2 max-w-md text-md text-text-secondary">
              {t("plugins.emptyBody")}
            </div>
            <Button
              className="mt-5"
              variant="primary"
              onClick={async () => {
                try {
                  await api.loadDevPlugin();
                  await refreshPlugins();
                } catch (e) {
                  showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
                }
              }}
            >
              {t("plugins.loadDev")}
            </Button>
          </Panel>
        ) : (
          <div className="dest-list">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="dest-row">
                <div className="dest-row-icon">
                  <IconAt size={16} />
                </div>
                <div className="dest-row-body">
                  <div className="dest-row-title">
                    <span className="min-w-0 truncate">{plugin.name}</span>
                    <Badge tone={plugin.enabled ? "success" : "neutral"}>
                      {plugin.enabled ? t("plugins.enable") : t("plugins.disable")}
                    </Badge>
                  </div>
                  <div className="dest-row-meta">
                    {plugin.id} · {plugin.version || "dev"}
                  </div>
                </div>
                <div className="dest-row-actions">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
