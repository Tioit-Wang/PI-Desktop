import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  IconCheck,
  IconChevronLeft,
  IconClose,
  IconConfig,
  IconInfo,
  IconPlus,
  IconSearch,
  IconServer,
  IconSettings,
  IconSnapshot,
  IconSparkles,
} from "../components/icons";
import type { ProviderPublic } from "@pi-desktop/shared";

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

function providerInitials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "P";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "P";
}

function hostFromBaseUrl(baseUrl?: string | null): string {
  if (!baseUrl) return "—";
  try {
    return new URL(baseUrl).host || baseUrl;
  } catch {
    return baseUrl.replace(/^https?:\/\//, "").split("/")[0] || baseUrl;
  }
}

function thinkingModeLabel(
  mode: ThinkingModePreset,
  t: (key: string) => string,
  levels?: readonly ThinkingLevel[] | null,
): string {
  switch (mode) {
    case "toggle":
      return t("settings.thinkingModeToggle");
    case "graded":
      return t("settings.thinkingModeGraded");
    case "custom": {
      const formatted = formatThinkingLevels(levels);
      return formatted
        ? `${t("settings.thinkingModeCustom")} (${formatted})`
        : t("settings.thinkingModeCustom");
    }
    default:
      return t("settings.thinkingModeOff");
  }
}

function ConfigurationSection() {
  const { t } = useTranslation();
  const providers = useAppStore((s) => s.providers);
  const settings = useAppStore((s) => s.settings);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const showToast = useAppStore((s) => s.showToast);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("Compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.oj.ink/v1");
  const [modelId, setModelId] = useState("mimo-v2.5");
  const [apiKey, setApiKey] = useState("");
  const [thinkingMode, setThinkingMode] = useState<ThinkingModePreset>("off");
  const [customThinkingLevels, setCustomThinkingLevels] = useState("off,high");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!settings) return null;

  const supportsReasoning = thinkingMode !== "off";
  const defaultProvider = providers.find((p) => p.id === settings.defaultProviderId) ?? null;
  const readyCount = providers.filter((p) => p.hasSecret || p.authKind === "none").length;

  const resetComposer = () => {
    setName("Compatible");
    setBaseUrl("https://api.oj.ink/v1");
    setModelId("mimo-v2.5");
    setApiKey("");
    setThinkingMode("off");
    setCustomThinkingLevels("off,high");
  };

  useEffect(() => {
    if (!dialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      setDialogOpen(false);
      resetComposer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, saving]);

  const saveProvider = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const selectedLevels =
        thinkingMode === "custom"
          ? parseThinkingLevelsInput(customThinkingLevels)
          : levelsForThinkingMode(thinkingMode);
      const created = await api.createProvider({
        name: name.trim(),
        vendorKey: "custom",
        type: "openai_compatible",
        protocol: "openai_compatible",
        baseUrl: baseUrl.trim(),
        authKind: "api_key_and_base_url",
        defaultModelId: modelId.trim(),
        secretValue: apiKey || undefined,
        apiStyle: "chat_completions",
        supportsReasoning,
        ...(selectedLevels ? { supportedThinkingLevels: selectedLevels } : {}),
      });
      await api.setSettings({
        ...settings,
        defaultProviderId: created.provider.id,
        defaultModelId: modelId.trim() || settings.defaultModelId,
      });
      setApiKey("");
      setDialogOpen(false);
      resetComposer();
      await refreshProviders();
      showToast(t("settings.providerSaved"), { variant: "success" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updateThinking = async (provider: ProviderPublic, mode: ThinkingModePreset) => {
    setBusyId(provider.id);
    try {
      await api.updateProvider({
        id: provider.id,
        supportsReasoning: mode !== "off",
        // Empty array clears an explicit sparse override.
        supportedThinkingLevels:
          mode === "toggle"
            ? ["off", "high"]
            : mode === "custom"
              ? provider.supportedThinkingLevels && provider.supportedThinkingLevels.length > 0
                ? [...provider.supportedThinkingLevels]
                : ["off", "high"]
              : [],
      });
      await refreshProviders();
      showToast(thinkingModeLabel(mode, t, provider.supportedThinkingLevels), {
        variant: "success",
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), {
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const makeDefault = async (provider: ProviderPublic) => {
    setBusyId(provider.id);
    try {
      await api.setSettings({
        ...settings,
        defaultProviderId: provider.id,
        defaultModelId: provider.defaultModelId || settings.defaultModelId,
      });
      await refreshProviders();
      showToast(t("settings.defaultUpdated"), { variant: "success" });
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), {
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const removeProvider = async (provider: ProviderPublic) => {
    setBusyId(provider.id);
    try {
      await api.deleteProvider(provider.id);
      await refreshProviders();
      showToast(t("settings.providerRemoved"), { variant: "success" });
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), {
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const testProvider = async (provider: ProviderPublic) => {
    setTestingId(provider.id);
    try {
      const result = (await api.testProvider(provider.id)) as {
        ok?: boolean;
        message?: string;
        network?: string;
        status?: number;
      };
      if (result?.ok) {
        showToast(t("settings.testOk"), { variant: "success" });
      } else {
        showToast(
          result?.message ||
            (result?.status
              ? t("settings.testFailedStatus", { status: result.status })
              : t("settings.testFailed")),
          { variant: "error" },
        );
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), {
        variant: "error",
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="settings-stack">
      <section className="provider-hero" aria-label={t("settings.providers")}>
        <div className="provider-hero-copy">
          <div className="provider-hero-kicker">
            <IconSparkles size={14} />
            <span>{t("settings.providersHeroKicker")}</span>
          </div>
          <h2 className="provider-hero-title">{t("settings.providersHeroTitle")}</h2>
          <p className="provider-hero-desc">{t("settings.providersHeroDesc")}</p>
        </div>
        <div className="provider-hero-stats" aria-label={t("settings.providersSummary")}>
          <div className="provider-stat">
            <div className="provider-stat-value">{providers.length}</div>
            <div className="provider-stat-label">{t("settings.providersCount")}</div>
          </div>
          <div className="provider-stat">
            <div className="provider-stat-value">{readyCount}</div>
            <div className="provider-stat-label">{t("settings.providersReady")}</div>
          </div>
          <div className="provider-stat provider-stat-wide">
            <div className="provider-stat-value provider-stat-value-text">
              {defaultProvider?.name || t("settings.noDefaultProvider")}
            </div>
            <div className="provider-stat-label">
              {defaultProvider?.defaultModelId ||
                settings.defaultModelId ||
                t("settings.noModel")}
            </div>
          </div>
        </div>
      </section>

      <SettingsCard title={t("settings.defaultsTitle")}>
        <SettingsRow title={t("settings.mode")} description={t("settings.modeDesc")}>
          <div className="settings-segment" role="group" aria-label={t("settings.mode")}>
            {([
              ["agent", "settings.modeAgent"],
              ["chat", "settings.modeChat"],
            ] as const).map(([value, labelKey]) => (
              <button
                key={value}
                type="button"
                className={cx(
                  "settings-segment-item",
                  settings.defaultMode === value && "active",
                )}
                aria-pressed={settings.defaultMode === value}
                onClick={async () => {
                  await api.setSettings({
                    ...settings,
                    defaultMode: value,
                  });
                  await refreshProviders();
                }}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
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
        <SettingsRow title={t("settings.enterToSend")} description={t("settings.enterToSendDesc")}>
          <button
            type="button"
            className={cx("settings-toggle", settings.enterToSend && "on")}
            role="switch"
            aria-checked={settings.enterToSend}
            aria-label={t("settings.enterToSend")}
            onClick={async () => {
              await api.setSettings({
                ...settings,
                enterToSend: !settings.enterToSend,
              });
              await refreshProviders();
            }}
          >
            <span className="settings-toggle-thumb" />
          </button>
        </SettingsRow>
      </SettingsCard>

      <section className="settings-card-block">
        <div className="provider-section-head">
          <div>
            <h3 className="settings-card-heading">{t("settings.providers")}</h3>
            <p className="provider-section-desc">{t("settings.providersSectionDesc")}</p>
          </div>
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            <span className="provider-add-btn-inner">
              <IconPlus size={14} />
              <span>{t("settings.addProvider")}</span>
            </span>
          </Button>
        </div>

        {dialogOpen ? (
          <div
            className="overlay provider-dialog-overlay"
            role="presentation"
            onClick={() => {
              if (saving) return;
              setDialogOpen(false);
              resetComposer();
            }}
          >
            <div
              className="dialog provider-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="provider-dialog-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="provider-dialog-head">
                <div className="provider-dialog-copy">
                  <div className="provider-dialog-kicker">{t("settings.openaiCompatible")}</div>
                  <h3 id="provider-dialog-title" className="provider-dialog-title">
                    {t("settings.addProviderTitle")}
                  </h3>
                  <p className="provider-dialog-desc">{t("settings.addProviderDesc")}</p>
                </div>
                <button
                  type="button"
                  className="provider-dialog-close"
                  aria-label={t("settings.cancel")}
                  disabled={saving}
                  onClick={() => {
                    setDialogOpen(false);
                    resetComposer();
                  }}
                >
                  <IconClose size={16} />
                </button>
              </div>

              <div className="provider-form-grid">
                <Field label={t("settings.name")}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </Field>
                <Field label={t("settings.baseUrl")}>
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="font-mono text-sm-plus"
                    placeholder="https://api.example.com/v1"
                  />
                </Field>
                <Field label={t("settings.modelId")}>
                  <Input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    className="font-mono text-sm-plus"
                    placeholder="gpt-4.1"
                  />
                </Field>
                <Field label={t("settings.apiKey")} hint={t("settings.apiKeyHint")}>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-…"
                    className="font-mono text-sm-plus"
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("settings.thinkingMode")} hint={t("settings.thinkingModeDesc")}>
                  <div
                    className="settings-segment settings-segment-wrap"
                    role="group"
                    aria-label={t("settings.thinkingMode")}
                  >
                    {(
                      [
                        ["off", "settings.thinkingModeOff"],
                        ["toggle", "settings.thinkingModeToggle"],
                        ["graded", "settings.thinkingModeGraded"],
                        ["custom", "settings.thinkingModeCustom"],
                      ] as const
                    ).map(([value, labelKey]) => (
                      <button
                        key={value}
                        type="button"
                        className={cx(
                          "settings-segment-item",
                          thinkingMode === value && "active",
                        )}
                        aria-pressed={thinkingMode === value}
                        onClick={() => setThinkingMode(value)}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
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
                      placeholder="off,high"
                    />
                  </Field>
                ) : null}
              </div>

              <div className="provider-dialog-actions">
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    setDialogOpen(false);
                    resetComposer();
                  }}
                >
                  {t("settings.cancel")}
                </Button>
                <Button
                  variant="primary"
                  disabled={saving || !name.trim() || !baseUrl.trim() || !modelId.trim()}
                  onClick={() => void saveProvider()}
                >
                  {saving ? t("settings.saving") : t("settings.saveProvider")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="settings-panel provider-list-panel">
          {providers.length === 0 ? (
            <div className="provider-empty">
              <div className="provider-empty-icon" aria-hidden>
                <IconServer size={18} />
              </div>
              <div className="provider-empty-title">{t("settings.noProviders")}</div>
              <div className="provider-empty-desc">{t("settings.noProvidersDesc")}</div>
              <Button variant="primary" onClick={() => setDialogOpen(true)}>
                <span className="provider-add-btn-inner">
                  <IconPlus size={14} />
                  <span>{t("settings.addProvider")}</span>
                </span>
              </Button>
            </div>
          ) : (
            <div className="provider-card-list">
              {providers.map((provider) => {
                const mode = thinkingModeFromLevels(
                  provider.supportsReasoning,
                  provider.supportedThinkingLevels,
                );
                const isDefault = settings.defaultProviderId === provider.id;
                const rowBusy = busyId === provider.id || testingId === provider.id;
                return (
                  <article
                    key={provider.id}
                    className={cx("provider-card", isDefault && "is-default")}
                  >
                    <div className="provider-card-main">
                      <div className="provider-avatar" aria-hidden>
                        {providerInitials(provider.name)}
                      </div>
                      <div className="provider-card-copy">
                        <div className="provider-card-title-row">
                          <h4 className="provider-card-title">{provider.name}</h4>
                          {isDefault ? (
                            <Badge tone="success">{t("settings.default")}</Badge>
                          ) : null}
                          <Badge tone={provider.hasSecret ? "success" : "warning"}>
                            {provider.hasSecret
                              ? t("settings.hasSecret")
                              : t("settings.noSecret")}
                          </Badge>
                        </div>
                        <div className="provider-card-meta">
                          <span className="provider-meta-item">
                            <IconServer size={12} />
                            {hostFromBaseUrl(provider.baseUrl)}
                          </span>
                          <span className="provider-meta-dot" aria-hidden>
                            ·
                          </span>
                          <span className="provider-meta-item font-mono">
                            {provider.defaultModelId || t("settings.noModel")}
                          </span>
                          <span className="provider-meta-dot" aria-hidden>
                            ·
                          </span>
                          <span className="provider-meta-item">
                            {thinkingModeLabel(mode, t, provider.supportedThinkingLevels)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="provider-card-controls">
                      <label className="provider-control">
                        <span className="provider-control-label">
                          {t("settings.thinkingMode")}
                        </span>
                        <Select
                          className="settings-pill-select"
                          aria-label={t("settings.thinkingMode")}
                          disabled={rowBusy}
                          value={mode}
                          onChange={(e) =>
                            void updateThinking(
                              provider,
                              e.target.value as ThinkingModePreset,
                            )
                          }
                        >
                          <option value="off">{t("settings.thinkingModeOff")}</option>
                          <option value="toggle">{t("settings.thinkingModeToggle")}</option>
                          <option value="graded">{t("settings.thinkingModeGraded")}</option>
                          {mode === "custom" ? (
                            <option value="custom">
                              {thinkingModeLabel("custom", t, provider.supportedThinkingLevels)}
                            </option>
                          ) : null}
                        </Select>
                      </label>

                      <div className="provider-card-actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={rowBusy}
                          onClick={() => void testProvider(provider)}
                        >
                          {testingId === provider.id
                            ? t("settings.testing")
                            : t("settings.testConnection")}
                        </Button>
                        {!isDefault ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={rowBusy}
                            onClick={() => void makeDefault(provider)}
                          >
                            <span className="provider-action-with-icon">
                              <IconCheck size={13} />
                              <span>{t("settings.makeDefault")}</span>
                            </span>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={rowBusy}
                          onClick={() => void removeProvider(provider)}
                        >
                          {t("settings.delete")}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const tab = useAppStore((s) => s.settingsTab);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setPage = useAppStore((s) => s.setPage);
  const settings = useAppStore((s) => s.settings);
  const version = useAppStore((s) => s.version);
  const refreshProviders = useAppStore((s) => s.refreshProviders);

  const [query, setQuery] = useState("");

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

          {tab === "agent" && <ConfigurationSection />}

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
