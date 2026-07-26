import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Button, Panel, cx } from "../components/ui";
import { IconAt, IconX } from "../components/icons";

export function PluginsPage() {
  const { t } = useTranslation();
  const plugins = useAppStore((s) => s.plugins);
  const refreshPlugins = useAppStore((s) => s.refreshPlugins);
  const showToast = useAppStore((s) => s.showToast);

  const loadDev = async () => {
    try {
      await api.loadDevPlugin();
      await refreshPlugins();
      showToast(t("plugins.loadDev"), { variant: "success" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    }
  };

  return (
    <div className="thread-scroll">
      <div className="page-frame">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t("plugins.title")}</h1>
            <div className="page-subtitle">{t("plugins.subtitle")}</div>
          </div>
          <Button variant="secondary" onClick={() => void loadDev()}>
            {t("plugins.loadDev")}
          </Button>
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
            <Button className="mt-5" variant="primary" onClick={() => void loadDev()}>
              {t("plugins.loadDev")}
            </Button>
          </Panel>
        ) : (
          <div className="plugins-list" role="list" aria-label={t("plugins.title")}>
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                role="listitem"
                className={cx("plugins-row", !plugin.enabled && "off")}
              >
                <span className="plugins-glyph">
                  <IconAt size={15} />
                </span>
                <span className="plugins-copy">
                  <span className="plugins-name">{plugin.name}</span>
                  <span className="plugins-meta">
                    {plugin.id} · {plugin.version || "dev"}
                  </span>
                </span>
                <button
                  type="button"
                  className="plugins-uninstall"
                  aria-label={t("plugins.uninstall")}
                  title={t("plugins.uninstall")}
                  onClick={async () => {
                    try {
                      await api.uninstallPlugin(plugin.id);
                      await refreshPlugins();
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : String(e), {
                        variant: "error",
                      });
                    }
                  }}
                >
                  <IconX size={14} />
                  {t("plugins.uninstall")}
                </button>
                <button
                  type="button"
                  className={cx("settings-toggle", plugin.enabled && "on")}
                  role="switch"
                  aria-checked={plugin.enabled}
                  aria-label={plugin.enabled ? t("plugins.disable") : t("plugins.enable")}
                  onClick={async () => {
                    try {
                      if (plugin.enabled) await api.disablePlugin(plugin.id);
                      else await api.enablePlugin(plugin.id);
                      await refreshPlugins();
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : String(e), {
                        variant: "error",
                      });
                    }
                  }}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
