import { useState } from "react";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";

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

  const [name, setName] = useState("OJ Compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.oj.ink/v1");
  const [modelId, setModelId] = useState("mimo-v2.5");
  const [apiKey, setApiKey] = useState("");

  const tabs = [
    ["providers", "Providers"],
    ["plugins", "Plugins"],
    ["appearance", "Appearance"],
    ["about", "About"],
  ] as const;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-xs text-slate-500">Providers, plugins, and app preferences</p>
        </div>
        <button
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
          onClick={() => setPage("chat")}
        >
          Back to chat
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-800 px-6 py-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === id ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900"
            }`}
            onClick={() => setSettingsTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        {tab === "providers" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h2 className="mb-3 text-sm font-semibold">Add provider</h2>
              <div className="space-y-3">
                <label className="block text-xs text-slate-400">
                  Name
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Base URL
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Default model
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  API key
                  <input
                    type="password"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-…"
                  />
                </label>
                <button
                  className="rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400"
                  onClick={async () => {
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
                      theme: settings?.theme ?? "system",
                      enterToSend: settings?.enterToSend ?? true,
                      onboardingDismissed: settings?.onboardingDismissed ?? false,
                    });
                    setApiKey("");
                    await refreshProviders();
                    setToast("Provider saved");
                  }}
                >
                  Save provider
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Configured providers</h2>
              {providers.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
                  No providers yet
                </div>
              )}
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.baseUrl || "no base url"} · {p.defaultModelId || "no model"}
                      </div>
                      <div className="mt-1 text-xs">
                        {p.hasSecret ? (
                          <span className="text-green-400">API key saved</span>
                        ) : (
                          <span className="text-amber-400">No API key</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="text-xs text-red-400 hover:text-red-300"
                      onClick={async () => {
                        await api.deleteProvider(p.id);
                        await refreshProviders();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "plugins" && (
          <div className="space-y-4">
            <button
              className="rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400"
              onClick={async () => {
                await api.loadDevPlugin();
                await refreshPlugins();
                setToast("Plugin loaded");
              }}
            >
              Load dev plugin…
            </button>
            {plugins.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
                No plugins installed. Try examples/plugins/hello
              </div>
            )}
            {plugins.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4"
              >
                <div>
                  <div className="font-medium">
                    {p.name}{" "}
                    <span className="text-xs text-slate-500">v{p.version}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.source} · {p.status} · {p.id}
                  </div>
                </div>
                <div className="flex gap-2">
                  {p.enabled ? (
                    <button
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs"
                      onClick={async () => {
                        await api.disablePlugin(p.id);
                        await refreshPlugins();
                      }}
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs"
                      onClick={async () => {
                        await api.enablePlugin(p.id);
                        await refreshPlugins();
                      }}
                    >
                      Enable
                    </button>
                  )}
                  <button
                    className="rounded-md border border-red-900 px-2 py-1 text-xs text-red-300"
                    onClick={async () => {
                      await api.uninstallPlugin(p.id);
                      await refreshPlugins();
                    }}
                  >
                    Uninstall
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "appearance" && (
          <div className="max-w-md space-y-3 text-sm text-slate-300">
            <p>MVP uses a dark developer theme by default.</p>
            <p>System/light/dark preference is stored in settings for future polish.</p>
          </div>
        )}

        {tab === "about" && (
          <div className="max-w-lg space-y-2 text-sm text-slate-300">
            <div>
              <span className="text-slate-500">App:</span> {version?.name}{" "}
              {version?.version}
            </div>
            <div>
              <span className="text-slate-500">Protocol:</span>{" "}
              {version?.protocolVersion}
            </div>
            <div>
              <span className="text-slate-500">Host:</span> {version?.hostVersion}{" "}
              (protocol {version?.hostProtocolVersion})
            </div>
            <div>
              <span className="text-slate-500">Platform:</span> {version?.platform}/
              {version?.arch}
            </div>
            <button
              className="mt-3 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
              onClick={() => void api.openLogs()}
            >
              Open logs folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
