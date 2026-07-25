import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Badge, Button, Field, Input, Select, cx } from "../components/ui";
import {
  IconAt,
  IconBrowser,
  IconChevronLeft,
  IconComputer,
  IconExternal,
  IconGitBranch,
  IconHook,
  IconInfo,
  IconKeyboard,
  IconLink,
  IconMic,
  IconPalette,
  IconPerson,
  IconPlug,
  IconSearch,
  IconServer,
  IconSettings,
  IconSliders,
  IconSparkles,
} from "../components/icons";

type SettingsTab = ReturnType<typeof useAppStore.getState>["settingsTab"];

type NavItem = {
  id: SettingsTab;
  labelKey: string;
  icon: ReactNode;
  external?: boolean;
};

type NavGroup = {
  key: string;
  headingKey: string;
  items: NavItem[];
};

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <div className="settings-row-title">{title}</div>
        {description ? <div className="settings-row-desc">{description}</div> : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function SettingsCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-card-block">
      {title ? <h3 className="settings-card-heading">{title}</h3> : null}
      <div className="settings-panel">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx("settings-toggle", checked && "on")}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

function PlaceholderBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="settings-empty-state">
      <div className="settings-empty-title">{title}</div>
      <div className="settings-empty-desc">{body}</div>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const tab = useAppStore((s) => s.settingsTab);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setPage = useAppStore((s) => s.setPage);
  const providers = useAppStore((s) => s.providers);
  const plugins = useAppStore((s) => s.plugins);
  const settings = useAppStore((s) => s.settings);
  const version = useAppStore((s) => s.version);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const refreshPlugins = useAppStore((s) => s.refreshPlugins);
  const setToast = useAppStore((s) => s.setToast);

  const [query, setQuery] = useState("");
  const [name, setName] = useState("Compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.oj.ink/v1");
  const [modelId, setModelId] = useState("mimo-v2.5");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  // Local visual prefs for Codex general permission rows (no host schema yet).
  const [defaultPermissions, setDefaultPermissions] = useState(true);
  const [autoReview, setAutoReview] = useState(true);
  const [fullAccess, setFullAccess] = useState(true);
  const [showMenuBar, setShowMenuBar] = useState(true);

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        key: "personal",
        headingKey: "settings.groupPersonal",
        items: [
          { id: "general", labelKey: "settings.general", icon: <IconSettings size={15} /> },
          { id: "appearance", labelKey: "settings.appearance", icon: <IconPalette size={15} /> },
          { id: "voice", labelKey: "settings.voice", icon: <IconMic size={15} /> },
          { id: "agent", labelKey: "settings.configuration", icon: <IconSliders size={15} /> },
          {
            id: "personalization",
            labelKey: "settings.personalization",
            icon: <IconPerson size={15} />,
          },
          { id: "providers", labelKey: "settings.providers", icon: <IconServer size={15} /> },
          { id: "keyboard", labelKey: "settings.keyboard", icon: <IconKeyboard size={15} /> },
          {
            id: "account",
            labelKey: "settings.account",
            icon: <IconAt size={15} />,
            external: true,
          },
          { id: "about", labelKey: "settings.about", icon: <IconInfo size={15} /> },
        ],
      },
      {
        key: "integrations",
        headingKey: "settings.groupIntegrations",
        items: [
          { id: "plugins", labelKey: "settings.plugins", icon: <IconPlug size={15} /> },
          { id: "mcp", labelKey: "settings.mcp", icon: <IconSparkles size={15} /> },
          { id: "browser", labelKey: "settings.browser", icon: <IconBrowser size={15} /> },
          { id: "computer", labelKey: "settings.computer", icon: <IconComputer size={15} /> },
        ],
      },
      {
        key: "coding",
        headingKey: "settings.groupCoding",
        items: [
          { id: "hooks", labelKey: "settings.hooks", icon: <IconHook size={15} /> },
          { id: "connections", labelKey: "settings.connections", icon: <IconLink size={15} /> },
          { id: "git", labelKey: "settings.git", icon: <IconGitBranch size={15} /> },
        ],
      },
    ],
    [],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navGroups;
    return navGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => t(item.labelKey).toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, query, t]);

  const activeLabel =
    navGroups.flatMap((g) => g.items).find((i) => i.id === tab)?.labelKey ?? "settings.title";

  return (
    <div className="settings-shell settings-shell-full">
      <aside className="settings-nav" aria-label={t("settings.title")}>
        <div className="settings-nav-top drag">
          <button
            type="button"
            className="settings-back no-drag"
            onClick={() => setPage("chat")}
          >
            <IconChevronLeft size={16} />
            <span>{t("settings.backToApp")}</span>
          </button>
          <div className="settings-search-wrap no-drag">
            <IconSearch size={14} />
            <input
              className="settings-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("settings.searchPlaceholder")}
              aria-label={t("settings.search")}
            />
          </div>
        </div>

        <div className="settings-nav-scroll no-drag">
          {groups.length === 0 ? (
            <div className="settings-nav-empty">{t("settings.noResults")}</div>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="settings-nav-group">
                <div className="settings-nav-heading">{t(group.headingKey)}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    className={cx("settings-nav-item", tab === item.id && "active")}
                    onClick={() => setSettingsTab(item.id)}
                  >
                    <span className="settings-nav-icon">{item.icon}</span>
                    <span className="settings-nav-label">{t(item.labelKey)}</span>
                    {item.external ? (
                      <span className="settings-nav-external">
                        <IconExternal size={12} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="settings-content">
        <div className="settings-content-inner">
          <h1 className="settings-section-title">{t(activeLabel)}</h1>

          {tab === "general" && settings && (
            <>
              <SettingsCard title={t("settings.permissions")}>
                <SettingsRow
                  title={t("settings.defaultPermissions")}
                  description={t("settings.defaultPermissionsDesc")}
                >
                  <Toggle
                    checked={defaultPermissions}
                    onChange={setDefaultPermissions}
                    label={t("settings.defaultPermissions")}
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings.autoReview")}
                  description={t("settings.autoReviewDesc")}
                >
                  <Toggle
                    checked={autoReview}
                    onChange={setAutoReview}
                    label={t("settings.autoReview")}
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings.fullAccess")}
                  description={t("settings.fullAccessDesc")}
                >
                  <Toggle
                    checked={fullAccess}
                    onChange={setFullAccess}
                    label={t("settings.fullAccess")}
                  />
                </SettingsRow>
              </SettingsCard>

              <SettingsCard title={t("settings.general")}>
                <SettingsRow
                  title={t("settings.enterToSend")}
                  description={t("settings.enterToSendDesc")}
                >
                  <Select
                    value={settings.enterToSend ? "yes" : "no"}
                    onChange={async (e) => {
                      await api.setSettings({
                        ...settings,
                        enterToSend: e.target.value === "yes",
                      });
                      await refreshProviders();
                    }}
                  >
                    <option value="yes">{t("settings.yes")}</option>
                    <option value="no">{t("settings.noCmdEnter")}</option>
                  </Select>
                </SettingsRow>
                <SettingsRow title={t("settings.mode")} description={t("settings.modeDesc")}>
                  <Select
                    value={settings.defaultMode}
                    onChange={async (e) => {
                      await api.setSettings({
                        ...settings,
                        defaultMode: e.target.value as "chat" | "agent",
                      });
                      await refreshProviders();
                    }}
                  >
                    <option value="agent">{t("settings.modeAgent")}</option>
                    <option value="chat">{t("settings.modeChat")}</option>
                  </Select>
                </SettingsRow>
                <SettingsRow
                  title={t("settings.showMenuBar")}
                  description={t("settings.showMenuBarDesc")}
                >
                  <Toggle
                    checked={showMenuBar}
                    onChange={setShowMenuBar}
                    label={t("settings.showMenuBar")}
                  />
                </SettingsRow>
              </SettingsCard>
            </>
          )}

          {tab === "appearance" && settings && (
            <SettingsCard>
              <SettingsRow title={t("settings.theme")} description={t("settings.themeDesc")}>
                <Select
                  value={settings.theme}
                  onChange={async (e) => {
                    await api.setSettings({
                      ...settings,
                      theme: e.target.value as "system" | "light" | "dark",
                    });
                    await refreshProviders();
                  }}
                >
                  <option value="system">{t("settings.themeSystem")}</option>
                  <option value="light">{t("settings.themeLight")}</option>
                  <option value="dark">{t("settings.themeDark")}</option>
                </Select>
              </SettingsRow>
              <div className="settings-theme-grid" role="group" aria-label={t("settings.theme")}>
                {(["light", "dark", "system"] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    className={cx(
                      "settings-theme-card",
                      settings.theme === theme && "active",
                      theme,
                    )}
                    onClick={async () => {
                      await api.setSettings({ ...settings, theme });
                      await refreshProviders();
                    }}
                  >
                    <span className="settings-theme-swatch" />
                    <span className="settings-theme-label">
                      {t(
                        theme === "light"
                          ? "settings.themeLight"
                          : theme === "dark"
                            ? "settings.themeDark"
                            : "settings.themeSystem",
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </SettingsCard>
          )}

          {tab === "agent" && settings && (
            <SettingsCard>
              <SettingsRow title={t("settings.mode")} description={t("settings.modeDesc")}>
                <Select
                  value={settings.defaultMode}
                  onChange={async (e) => {
                    await api.setSettings({
                      ...settings,
                      defaultMode: e.target.value as "chat" | "agent",
                    });
                    await refreshProviders();
                  }}
                >
                  <option value="agent">{t("settings.modeAgent")}</option>
                  <option value="chat">{t("settings.modeChat")}</option>
                </Select>
              </SettingsRow>
              <SettingsRow title={t("settings.modelId")} description={t("settings.modelIdDesc")}>
                <Input
                  value={settings.defaultModelId || ""}
                  onChange={async (e) => {
                    await api.setSettings({
                      ...settings,
                      defaultModelId: e.target.value,
                    });
                  }}
                  onBlur={async () => {
                    await refreshProviders();
                  }}
                  className="font-mono text-[12.5px]"
                  placeholder="model-id"
                />
              </SettingsRow>
            </SettingsCard>
          )}

          {tab === "providers" && (
            <div className="settings-stack">
              <SettingsCard title={t("settings.addProvider")}>
                <div className="settings-form-grid">
                  <Field label={t("settings.name")}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label={t("settings.baseUrl")}>
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="font-mono text-[12.5px]"
                    />
                  </Field>
                  <Field label={t("settings.modelId")}>
                    <Input
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      className="font-mono text-[12.5px]"
                    />
                  </Field>
                  <Field label={t("settings.apiKey")}>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-…"
                      className="font-mono text-[12.5px]"
                    />
                  </Field>
                </div>
                <div className="settings-panel-actions">
                  <Button
                    variant="primary"
                    disabled={saving || !name.trim()}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const created = await api.createProvider({
                          name,
                          vendorKey: "custom",
                          type: "openai_compatible",
                          protocol: "openai_compatible",
                          baseUrl,
                          authKind: "api_key_and_base_url",
                          defaultModelId: modelId,
                          secretValue: apiKey || undefined,
                          apiStyle: "chat_completions",
                        });
                        await api.setSettings({
                          ...(settings as any),
                          defaultProviderId: created.provider.id,
                          defaultModelId: modelId,
                          defaultMode: settings?.defaultMode ?? "agent",
                          theme: settings?.theme ?? "dark",
                          enterToSend: settings?.enterToSend ?? true,
                          onboardingDismissed: settings?.onboardingDismissed ?? false,
                        });
                        setApiKey("");
                        await refreshProviders();
                        setToast(t("settings.providerSaved"));
                      } catch (e) {
                        setToast(e instanceof Error ? e.message : String(e));
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? t("settings.saving") : t("settings.saveProvider")}
                  </Button>
                </div>
              </SettingsCard>

              <SettingsCard title={t("settings.configured")}>
                <div className="settings-list">
                  {providers.length === 0 ? (
                    <div className="settings-empty">{t("settings.noProviders")}</div>
                  ) : (
                    providers.map((p) => (
                      <div key={p.id} className="settings-list-row">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-medium">{p.name}</div>
                          <div className="truncate font-mono text-[11.5px] text-text-muted">
                            {p.baseUrl || "—"} · {p.defaultModelId || t("settings.noModel")}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {settings?.defaultProviderId === p.id ? (
                            <Badge tone="success">{t("settings.default")}</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (!settings) return;
                                await api.setSettings({
                                  ...settings,
                                  defaultProviderId: p.id,
                                  defaultModelId: p.defaultModelId || settings.defaultModelId,
                                });
                                await refreshProviders();
                                setToast(t("settings.defaultUpdated"));
                              }}
                            >
                              {t("settings.makeDefault")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await api.deleteProvider(p.id);
                              await refreshProviders();
                              setToast(t("settings.providerRemoved"));
                            }}
                          >
                            {t("settings.delete")}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SettingsCard>
            </div>
          )}

          {tab === "plugins" && (
            <div className="settings-stack">
              <div className="settings-panel-toolbar">
                <h3 className="settings-card-heading" style={{ margin: 0 }}>
                  {t("settings.installedPlugins")}
                </h3>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await api.loadDevPlugin();
                      await refreshPlugins();
                      setToast(t("settings.devPluginLoaded"));
                    } catch (e) {
                      setToast(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  {t("settings.loadDevPlugin")}
                </Button>
              </div>
              <SettingsCard>
                <div className="settings-list">
                  {plugins.length === 0 ? (
                    <div className="settings-empty">{t("settings.noPlugins")}</div>
                  ) : (
                    plugins.map((plugin) => (
                      <div key={plugin.id} className="settings-list-row">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-medium">{plugin.name}</div>
                          <div className="truncate text-[12px] text-text-muted">
                            {plugin.id} · {plugin.version || "dev"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={plugin.enabled ? "success" : "neutral"}>
                            {plugin.enabled ? t("settings.enabled") : t("settings.disabled")}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (plugin.enabled) await api.disablePlugin(plugin.id);
                              else await api.enablePlugin(plugin.id);
                              await refreshPlugins();
                            }}
                          >
                            {plugin.enabled ? t("settings.disable") : t("settings.enable")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await api.uninstallPlugin(plugin.id);
                              await refreshPlugins();
                            }}
                          >
                            {t("settings.uninstall")}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SettingsCard>
            </div>
          )}

          {tab === "about" && (
            <SettingsCard>
              <SettingsRow title={t("settings.application")} description={t("settings.applicationDesc")}>
                <div className="settings-about-meta">
                  <div className="font-medium">
                    {version?.name || "PI-Desktop"} {version?.version}
                  </div>
                  <div className="font-mono text-[11.5px] text-text-muted">
                    protocol {version?.protocolVersion} · host {version?.hostVersion}
                  </div>
                </div>
              </SettingsRow>
              <SettingsRow title={t("settings.logs")} description={t("settings.logsDesc")}>
                <Button variant="secondary" onClick={() => void api.openLogs()}>
                  {t("settings.openLogs")}
                </Button>
              </SettingsRow>
            </SettingsCard>
          )}

          {(
            [
              "voice",
              "personalization",
              "keyboard",
              "account",
              "mcp",
              "browser",
              "computer",
              "hooks",
              "connections",
              "git",
            ] as SettingsTab[]
          ).includes(tab) && (
            <SettingsCard>
              <PlaceholderBody
                title={t(activeLabel)}
                body={t("settings.placeholderBody")}
              />
            </SettingsCard>
          )}
        </div>
      </div>
    </div>
  );
}
