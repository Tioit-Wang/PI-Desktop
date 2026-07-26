import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ThinkingLevel } from "@pi-desktop/shared";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import type { ImportCandidate } from "../lib/api";
import {
  DEFAULT_IMPORT_GROUP_BY,
  formatImportDate,
  groupImportCandidates,
  type ImportGroupBy,
} from "../lib/import-groups";
import { Badge, Button, Field, Input, Select, cx } from "../components/ui";
import {
  IconChevronLeft,
  IconConfig,
  IconInfo,
  IconSearch,
  IconSettings,
  IconSnapshot,
} from "../components/icons";

type SettingsTab = ReturnType<typeof useAppStore.getState>["settingsTab"];

type NavItem = {
  id: SettingsTab;
  labelKey: string;
  icon: ReactNode;
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

function ImportSection() {
  const { t, i18n } = useTranslation();
  const refreshSessions = useAppStore((s) => s.refreshSessions);
  const showToast = useAppStore((s) => s.showToast);
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<ImportGroupBy>(DEFAULT_IMPORT_GROUP_BY);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);

  const keyOf = (c: ImportCandidate) => `${c.source}:${c.externalId}`;

  const scan = async () => {
    setScanning(true);
    try {
      const res = await api.scanImportSessions();
      setCandidates(res.sessions);
      setSelected(new Set());
      setExpandedGroups(new Set());
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    } finally {
      setScanning(false);
    }
  };

  const runImport = async () => {
    if (!candidates) return;
    const items = candidates.filter((c) => selected.has(keyOf(c)));
    if (items.length === 0) return;
    setImporting(true);
    try {
      const res = await api.runImportSessions(items);
      await refreshSessions();
      showToast(
        t("settings.importResult", {
          imported: res.imported,
          skipped: res.skipped,
          failed: res.failed,
        }),
        { variant: res.failed > 0 ? "error" : "success" },
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    } finally {
      setImporting(false);
    }
  };

  const importLabels = useMemo(
    () => ({
      noProject: t("settings.importNoProject"),
      sources: {
        "claude-code": t("settings.importSourceClaudeCode"),
        opencode: t("settings.importSourceOpenCode"),
        codex: t("settings.importSourceCodex"),
        pi: t("settings.importSourcePi"),
      },
    }),
    [t],
  );

  const groups = useMemo(
    () => groupImportCandidates(candidates ?? [], groupBy, importLabels),
    [candidates, groupBy, importLabels],
  );

  const allKeys = useMemo(() => (candidates ?? []).map(keyOf), [candidates]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  const toggleKeys = (keys: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  };

  return (
    <div className="settings-stack">
      <SettingsCard title={t("settings.importTitle")}>
        <SettingsRow
          title={t("settings.importScan")}
          description={t("settings.importScanDesc")}
        >
          <Button variant="secondary" disabled={scanning} onClick={() => void scan()}>
            {scanning ? t("settings.importScanning") : t("settings.importScan")}
          </Button>
        </SettingsRow>
      </SettingsCard>

      {candidates !== null && (
        <SettingsCard>
          {candidates.length === 0 ? (
            <div className="settings-empty">{t("settings.importNone")}</div>
          ) : (
            <>
              <div className="import-toolbar">
                <label className="import-select-all">
                  <input
                    type="checkbox"
                    aria-label={t("settings.importSelectAll")}
                    checked={allSelected}
                    onChange={(e) => toggleKeys(allKeys, e.target.checked)}
                  />
                  <span>
                    {t("settings.importFound", { count: candidates.length })}
                    {selected.size > 0
                      ? ` · ${t("settings.importSelectedCount", { count: selected.size })}`
                      : ""}
                  </span>
                </label>
                <div className="import-toolbar-actions">
                  <label className="import-group-by">
                    <span>{t("settings.importGroupBy")}</span>
                    <Select
                      value={groupBy}
                      className="settings-pill-select import-group-select"
                      onChange={(event) => {
                        setGroupBy(event.target.value as ImportGroupBy);
                        setExpandedGroups(new Set());
                      }}
                    >
                      <option value="source">{t("settings.importGroupBySource")}</option>
                      <option value="path">{t("settings.importGroupByPath")}</option>
                    </Select>
                  </label>
                  <Button
                    variant="primary"
                    disabled={importing || selected.size === 0}
                    onClick={() => void runImport()}
                  >
                    {importing
                      ? t("settings.importing")
                      : t("settings.importSelected", { count: selected.size })}
                  </Button>
                </div>
              </div>

              <div className="import-groups">
                {groups.map((group, groupIndex) => {
                  const groupKeys = group.items.map(keyOf);
                  const groupSelected = groupKeys.filter((k) => selected.has(k)).length;
                  const isCollapsed = !expandedGroups.has(group.id);
                  const groupBodyId = `import-group-body-${groupIndex}`;
                  return (
                    <div key={group.id} className="import-group">
                      <div className="import-group-header">
                        <input
                          type="checkbox"
                          aria-label={t("settings.importSelectGroup", { name: group.name })}
                          checked={groupSelected === groupKeys.length}
                          ref={(el) => {
                            if (el)
                              el.indeterminate =
                                groupSelected > 0 && groupSelected < groupKeys.length;
                          }}
                          onChange={(e) => toggleKeys(groupKeys, e.target.checked)}
                        />
                        <button
                          type="button"
                          className="import-group-toggle"
                          aria-controls={groupBodyId}
                          aria-expanded={!isCollapsed}
                          onClick={() =>
                            setExpandedGroups((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.id)) next.delete(group.id);
                              else next.add(group.id);
                              return next;
                            })
                          }
                        >
                          <span
                            className={cx("import-group-chevron", isCollapsed && "collapsed")}
                            aria-hidden
                          >
                            <IconChevronLeft size={13} />
                          </span>
                          <span className="import-group-name">{group.name}</span>
                          {group.projectPath ? (
                            <span className="import-group-path">{group.projectPath}</span>
                          ) : null}
                          <span className="import-group-count">
                            {t("settings.importSessionCount", { count: group.items.length })}
                          </span>
                        </button>
                      </div>
                      {!isCollapsed && (
                        <div id={groupBodyId} className="import-group-body">
                          {group.items.map((c) => {
                            const k = keyOf(c);
                            return (
                              <label key={k} className="import-row">
                                <input
                                  type="checkbox"
                                  checked={selected.has(k)}
                                  onChange={(e) => toggleKeys([k], e.target.checked)}
                                />
                                <span className="import-row-main">
                                  <span className="import-row-title">{c.title}</span>
                                  <span className="import-row-meta">
                                    {t("settings.importMessages", { count: c.messageCount })}
                                    {" · "}
                                    {formatImportDate(
                                      c.updatedAt,
                                      i18n.resolvedLanguage || i18n.language,
                                    )}
                                  </span>
                                </span>
                                <Badge tone="neutral">{importLabels.sources[c.source]}</Badge>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SettingsCard>
      )}
    </div>
  );
}


const CANONICAL_THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

type ThinkingModePreset = "off" | "toggle" | "graded" | "custom";

function uniqueThinkingLevels(levels: readonly ThinkingLevel[]): ThinkingLevel[] {
  const out: ThinkingLevel[] = [];
  for (const level of levels) {
    if (!CANONICAL_THINKING_LEVELS.includes(level) || out.includes(level)) continue;
    out.push(level);
  }
  return out;
}

function thinkingModeFromLevels(
  supportsReasoning: boolean,
  levels?: readonly ThinkingLevel[] | null,
): ThinkingModePreset {
  if (!supportsReasoning) return "off";
  const normalized = uniqueThinkingLevels(levels ?? []);
  if (normalized.length === 0) return "graded";
  if (
    normalized.length === 2 &&
    normalized.includes("off") &&
    normalized.includes("high")
  ) {
    return "toggle";
  }
  const gradedDefault: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high"];
  if (
    normalized.length === gradedDefault.length &&
    gradedDefault.every((level, index) => normalized[index] === level)
  ) {
    return "graded";
  }
  return "custom";
}

function levelsForThinkingMode(mode: ThinkingModePreset): ThinkingLevel[] | undefined {
  switch (mode) {
    case "off":
      return undefined;
    case "toggle":
      return ["off", "high"];
    case "graded":
      // Omit explicit list so runtime uses the conservative default graded set.
      return undefined;
    case "custom":
      return undefined;
  }
}

function formatThinkingLevels(levels?: readonly ThinkingLevel[] | null): string {
  if (!levels || levels.length === 0) return "";
  return levels.join(",");
}

function parseThinkingLevelsInput(raw: string): ThinkingLevel[] {
  const parts = raw
    .split(/[\s,|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return uniqueThinkingLevels(parts as ThinkingLevel[]);
}

export function SettingsPage() {
  const { t } = useTranslation();
  const tab = useAppStore((s) => s.settingsTab);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setPage = useAppStore((s) => s.setPage);
  const providers = useAppStore((s) => s.providers);
  const settings = useAppStore((s) => s.settings);
  const version = useAppStore((s) => s.version);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const showToast = useAppStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [name, setName] = useState("Compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.oj.ink/v1");
  const [modelId, setModelId] = useState("mimo-v2.5");
  const [apiKey, setApiKey] = useState("");
  const [thinkingMode, setThinkingMode] = useState<ThinkingModePreset>("off");
  const [customThinkingLevels, setCustomThinkingLevels] = useState("off,high");
  const [saving, setSaving] = useState(false);
  const supportsReasoning = thinkingMode !== "off";

  const navItems: NavItem[] = useMemo(
    () => [
      { id: "general", labelKey: "settings.general", icon: <IconSettings size={14} /> },
      { id: "agent", labelKey: "settings.configuration", icon: <IconConfig size={14} /> },
      { id: "import", labelKey: "settings.import", icon: <IconSnapshot size={14} /> },
      { id: "about", labelKey: "settings.about", icon: <IconInfo size={14} /> },
    ],
    [],
  );

  const filteredNavItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((item) => t(item.labelKey).toLowerCase().includes(q));
  }, [navItems, query, t]);

  const activeLabel =
    navItems.find((item) => item.id === tab)?.labelKey ?? "settings.title";

  return (
    <div className="settings-shell settings-shell-full">
      <div className="settings-titlebar" aria-hidden="true" />
      <aside className="settings-nav" aria-label={t("settings.title")}>
        <div className="settings-nav-top drag">
          <button
            type="button"
            className="settings-back no-drag"
            onClick={() => setPage("chat")}
          >
            <IconChevronLeft size={15} />
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
          {filteredNavItems.length === 0 ? (
            <div className="settings-nav-empty">{t("settings.noResults")}</div>
          ) : (
            filteredNavItems.map((item) => (
              <button
                key={item.id}
                className={cx("settings-nav-item", tab === item.id && "active")}
                onClick={() => setSettingsTab(item.id)}
              >
                <span className="settings-nav-icon">{item.icon}</span>
                <span className="settings-nav-label">{t(item.labelKey)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="settings-content">
        <div className="settings-content-inner">
          <h1 className="settings-section-title">{t(activeLabel)}</h1>

          {tab === "general" && settings && (
            <>
              <SettingsCard title={t("settings.appearance")}>
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
            </>
          )}

          {tab === "agent" && settings && (
            <div className="settings-stack">
              <SettingsCard title={t("settings.configuration")}>
                <SettingsRow title={t("settings.mode")} description={t("settings.modeDesc")}>
                  <Select
                    className="settings-pill-select"
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
                    key={settings.defaultModelId || ""}
                    defaultValue={settings.defaultModelId || ""}
                    onBlur={async (e) => {
                      await api.setSettings({
                        ...settings,
                        defaultModelId: e.target.value,
                      });
                      await refreshProviders();
                    }}
                    className="font-mono text-sm-plus"
                    placeholder="model-id"
                  />
                </SettingsRow>
                <SettingsRow
                  title={t("settings.enterToSend")}
                  description={t("settings.enterToSendDesc")}
                >
                  <Select
                    className="settings-pill-select"
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
              </SettingsCard>

              <SettingsCard title={t("settings.addProvider")}>
                <div className="settings-form-grid">
                  <Field label={t("settings.name")}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label={t("settings.baseUrl")}>
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="font-mono text-sm-plus"
                    />
                  </Field>
                  <Field label={t("settings.modelId")}>
                    <Input
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      className="font-mono text-sm-plus"
                    />
                  </Field>
                  <Field label={t("settings.apiKey")}>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-…"
                      className="font-mono text-sm-plus"
                    />
                  </Field>
                  <Field
                    label={t("settings.thinkingMode")}
                    hint={t("settings.thinkingModeDesc")}
                  >
                    <Select
                      value={thinkingMode}
                      onChange={(e) =>
                        setThinkingMode(e.target.value as ThinkingModePreset)
                      }
                      className="settings-pill-select"
                    >
                      <option value="off">{t("settings.thinkingModeOff")}</option>
                      <option value="toggle">{t("settings.thinkingModeToggle")}</option>
                      <option value="graded">{t("settings.thinkingModeGraded")}</option>
                      <option value="custom">{t("settings.thinkingModeCustom")}</option>
                    </Select>
                  </Field>
                  {thinkingMode === "custom" ? (
                    <Field
                      label={t("settings.thinkingLevels")}
                      hint={t("settings.thinkingLevelsDesc")}
                    >
                      <Input
                        value={customThinkingLevels}
                        onChange={(e) => setCustomThinkingLevels(e.target.value)}
                        className="font-mono text-sm-plus"
                        placeholder='off,high'
                      />
                    </Field>
                  ) : null}
                </div>
                <div className="settings-panel-actions">
                  <Button
                    variant="primary"
                    disabled={saving || !name.trim()}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const selectedLevels =
                          thinkingMode === "custom"
                            ? parseThinkingLevelsInput(customThinkingLevels)
                            : levelsForThinkingMode(thinkingMode);
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
                          supportsReasoning,
                          ...(selectedLevels ? { supportedThinkingLevels: selectedLevels } : {}),
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
                        showToast(t("settings.providerSaved"), { variant: "success" });
                      } catch (e) {
                        showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
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
                          <div className="truncate text-md-plus font-medium">{p.name}</div>
                          <div className="truncate font-mono text-xs-plus text-text-muted">
                            {p.baseUrl || "—"} · {p.defaultModelId || t("settings.noModel")}
                            {p.supportsReasoning
                              ? ` · ${t("settings.thinkingMode")}: ${
                                  thinkingModeFromLevels(
                                    p.supportsReasoning,
                                    p.supportedThinkingLevels,
                                  ) === "toggle"
                                    ? t("settings.thinkingModeToggle")
                                    : thinkingModeFromLevels(
                                          p.supportsReasoning,
                                          p.supportedThinkingLevels,
                                        ) === "graded"
                                      ? t("settings.thinkingModeGraded")
                                      : formatThinkingLevels(p.supportedThinkingLevels) ||
                                        t("settings.thinkingModeCustom")
                                }`
                              : ` · ${t("settings.thinkingModeOff")}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Select
                            className="settings-pill-select"
                            aria-label={t("settings.thinkingMode")}
                            value={thinkingModeFromLevels(
                              p.supportsReasoning,
                              p.supportedThinkingLevels,
                            )}
                            onChange={async (e) => {
                              const mode = e.target.value as ThinkingModePreset;
                              try {
                                await api.updateProvider({
                                  id: p.id,
                                  supportsReasoning: mode !== "off",
                                  // Empty array clears an explicit sparse override.
                                  supportedThinkingLevels:
                                    mode === "toggle"
                                      ? ["off", "high"]
                                      : mode === "custom"
                                        ? p.supportedThinkingLevels &&
                                          p.supportedThinkingLevels.length > 0
                                          ? [...p.supportedThinkingLevels]
                                          : ["off", "high"]
                                        : [],
                                });
                                await refreshProviders();
                                showToast(
                                  mode === "off"
                                    ? t("settings.thinkingModeOff")
                                    : mode === "toggle"
                                      ? t("settings.thinkingModeToggle")
                                      : mode === "graded"
                                        ? t("settings.thinkingModeGraded")
                                        : t("settings.thinkingModeCustom"),
                                  { variant: "success" },
                                );
                              } catch (error) {
                                showToast(
                                  error instanceof Error ? error.message : String(error),
                                  { variant: "error" },
                                );
                              }
                            }}
                          >
                            <option value="off">{t("settings.thinkingModeOff")}</option>
                            <option value="toggle">{t("settings.thinkingModeToggle")}</option>
                            <option value="graded">{t("settings.thinkingModeGraded")}</option>
                            {thinkingModeFromLevels(
                              p.supportsReasoning,
                              p.supportedThinkingLevels,
                            ) === "custom" ? (
                              <option value="custom">
                                {t("settings.thinkingModeCustom")}
                                {formatThinkingLevels(p.supportedThinkingLevels)
                                  ? ` (${formatThinkingLevels(p.supportedThinkingLevels)})`
                                  : ""}
                              </option>
                            ) : null}
                          </Select>
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
                                showToast(t("settings.defaultUpdated"), { variant: "success" });
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
                              showToast(t("settings.providerRemoved"), { variant: "success" });
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

          {tab === "import" && <ImportSection />}

          {tab === "about" && (
            <SettingsCard>
              <SettingsRow title={t("settings.application")} description={t("settings.applicationDesc")}>
                <div className="settings-about-meta">
                  <div className="font-medium">
                    {version?.name || "PI-Desktop"} {version?.version}
                  </div>
                  <div className="font-mono text-xs-plus text-text-muted">
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

        </div>
      </div>
    </div>
  );
}
