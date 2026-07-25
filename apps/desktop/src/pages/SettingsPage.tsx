import { useState } from "react";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Badge, Button, Field, Input, Panel, Select, cx } from "../components/ui";

export function SettingsPage() {
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

  const [name, setName] = useState("Compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.oj.ink/v1");
  const [modelId, setModelId] = useState("mimo-v2.5");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const tabs = [
    ["appearance", "General"],
    ["providers", "Providers"],
    ["plugins", "Plugins"],
    ["about", "About"],
  ] as const;

  return (
    <div className="settings-shell">
      <div className="settings-topbar">
        <div className="text-[14px] font-medium">Settings</div>
        <Button size="sm" variant="ghost" onClick={() => setPage("chat")}>
          Back
        </Button>
      </div>

      <div className="settings-body">
        <aside className="settings-nav" aria-label="Settings">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              className={cx("settings-nav-item", tab === id && "active")}
              onClick={() => setSettingsTab(id)}
            >
              {label}
            </button>
          ))}
        </aside>
        <div className="settings-content">
        {tab === "providers" && (
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
            <Panel className="p-4">
              <div className="mb-3 text-[13.5px] font-medium">Add provider</div>
              <div className="space-y-3">
                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Base URL">
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="font-mono text-[12.5px]"
                  />
                </Field>
                <Field label="Default model">
                  <Input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    className="font-mono text-[12.5px]"
                  />
                </Field>
                <Field label="API key">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-…"
                    className="font-mono text-[12.5px]"
                  />
                </Field>
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
                      setToast("Provider saved");
                    } catch (e) {
                      setToast(e instanceof Error ? e.message : String(e));
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Save provider"}
                </Button>
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="mb-3 text-[13.5px] font-medium">Configured</div>
              <div className="space-y-2">
                {providers.length === 0 ? (
                  <div className="text-[13px] text-text-muted">No providers yet</div>
                ) : (
                  providers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start justify-between gap-3 rounded-[12px] border border-border-subtle px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium">{p.name}</div>
                        <div className="truncate font-mono text-[11.5px] text-text-muted">
                          {p.baseUrl || "—"} · {p.defaultModelId || "no model"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {settings?.defaultProviderId === p.id ? (
                          <Badge tone="success">default</Badge>
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
                              setToast("Default provider updated");
                            }}
                          >
                            Make default
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await api.deleteProvider(p.id);
                            await refreshProviders();
                            setToast("Provider removed");
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        )}

        {tab === "plugins" && (
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[13.5px] font-medium">Plugins</div>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await api.loadDevPlugin();
                    await refreshPlugins();
                    setToast("Dev plugin loaded");
                  } catch (e) {
                    setToast(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Load dev plugin
              </Button>
            </div>
            {plugins.length === 0 ? (
              <Panel className="p-4 text-[13px] text-text-muted">No plugins installed</Panel>
            ) : (
              plugins.map((plugin) => (
                <Panel key={plugin.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{plugin.name}</div>
                    <div className="truncate text-[12px] text-text-muted">
                      {plugin.id} · {plugin.version || "dev"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={plugin.enabled ? "success" : "neutral"}>
                      {plugin.enabled ? "enabled" : "disabled"}
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
                      {plugin.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api.uninstallPlugin(plugin.id);
                        await refreshPlugins();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "appearance" && settings && (
          <div className="mx-auto max-w-xl space-y-4">
            <Panel className="space-y-4 p-4">
              <Field label="Theme">
                <Select
                  value={settings.theme}
                  onChange={async (e) => {
                    const theme = e.target.value as "system" | "light" | "dark";
                    await api.setSettings({ ...settings, theme });
                    await refreshProviders();
                    document.documentElement.dataset.theme =
                      theme === "system"
                        ? window.matchMedia("(prefers-color-scheme: light)").matches
                          ? "light"
                          : "dark"
                        : theme;
                    setToast(`Theme: ${theme}`);
                  }}
                >
                  <option value="dark">Dark (Codex)</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </Select>
              </Field>
              <Field label="Enter to send">
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
                  <option value="yes">Yes</option>
                  <option value="no">No (⌘/Ctrl+Enter)</option>
                </Select>
              </Field>
              <Field label="Default mode">
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
                  <option value="agent">Agent</option>
                  <option value="chat">Chat</option>
                </Select>
              </Field>
            </Panel>
          </div>
        )}

        {tab === "about" && (
          <div className="mx-auto max-w-xl">
            <Panel className="space-y-2 p-4 text-[13px]">
              <div className="text-[15px] font-medium">
                {version?.name || "PI-Desktop"} {version?.version}
              </div>
              <div className="text-text-secondary">
                Local-first coding agent desktop client with Codex-aligned workstation UI.
              </div>
              <div className="font-mono text-[11.5px] text-text-muted">
                protocol {version?.protocolVersion} · host {version?.hostVersion}
              </div>
              <div className="pt-2">
                <Button variant="secondary" onClick={() => void api.openLogs()}>
                  Open logs
                </Button>
              </div>
            </Panel>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
