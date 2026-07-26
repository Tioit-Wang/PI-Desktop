import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderPublic, ThinkingLevel } from "@pi-desktop/shared";
import { useAppStore } from "../stores/app-store";
import { BrandLogo } from "./BrandLogo";
import {
  IconArrowUp,
  IconShield,
  IconStop,
  IconChevronDown,
} from "./icons";

const COMPOSER_MIN_HEIGHT_PX = 28;
const COMPOSER_MAX_VISIBLE_ROWS = 7;

/**
 * Keep the display order in sync with the runtime's extended thinking
 * levels. Providers decide which of these entries are actually rendered.
 */
export const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

const THINKING_LEVEL_I18N_KEYS: Record<ThinkingLevel, string> = {
  off: "chat.effortOff",
  minimal: "chat.effortMinimal",
  low: "chat.effortLow",
  medium: "chat.effortMid",
  high: "chat.effortHigh",
  xhigh: "chat.effortXhigh",
  max: "chat.effortMax",
};

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && THINKING_LEVELS.includes(value as ThinkingLevel);
}

function providerThinkingLevels(provider?: ProviderPublic | null): ThinkingLevel[] {
  if (!provider?.supportsReasoning) return [];
  const declared = new Set(
    Array.isArray(provider.supportedThinkingLevels)
      ? provider.supportedThinkingLevels
      : [],
  );
  return THINKING_LEVELS.filter((level) => declared.has(level));
}

/**
 * Preserve the current level when changing providers, but never carry a
 * reasoning level into a provider that cannot accept it.
 */
export function thinkingLevelForProvider(
  provider: ProviderPublic | null | undefined,
  current: ThinkingLevel,
): ThinkingLevel {
  const available = providerThinkingLevels(provider);
  if (!provider?.supportsReasoning) return "off";
  if (available.includes(current)) return current;
  const requestedIndex = THINKING_LEVELS.indexOf(current);
  for (let index = requestedIndex; index < THINKING_LEVELS.length; index += 1) {
    const candidate = THINKING_LEVELS[index];
    if (available.includes(candidate)) return candidate;
  }
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = THINKING_LEVELS[index];
    if (available.includes(candidate)) return candidate;
  }
  return "off";
}

function cssPixels(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function Composer({ variant = "docked" }: { variant?: "home" | "docked" }) {
  const { t } = useTranslation();
  const sendPrompt = useAppStore((s) => s.sendPrompt);
  const abort = useAppStore((s) => s.abort);
  const isRunning = useAppStore((s) => s.isRunning);
  const settings = useAppStore((s) => s.settings);
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const providers = useAppStore((s) => s.providers);
  const configureActiveSession = useAppStore((s) => s.configureActiveSession);
  const showToast = useAppStore((s) => s.showToast);
  const composerPrefill = useAppStore((s) => s.composerPrefill);
  const clearComposerPrefill = useAppStore((s) => s.clearComposerPrefill);
  const [value, setValue] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!composerPrefill) return;
    setValue(composerPrefill);
    clearComposerPrefill();
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }, [composerPrefill, clearComposerPrefill]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure wrapped visual lines, not newline characters. The draft starts
    // at one optical row, grows through seven rows, then scrolls internally.
    el.style.height = "auto";
    const style = window.getComputedStyle(el);
    const lineHeight = cssPixels(style.lineHeight) || COMPOSER_MIN_HEIGHT_PX;
    const verticalChrome =
      cssPixels(style.paddingTop) +
      cssPixels(style.paddingBottom) +
      cssPixels(style.borderTopWidth) +
      cssPixels(style.borderBottomWidth);
    const maxHeight = Math.ceil(
      lineHeight * COMPOSER_MAX_VISIBLE_ROWS + verticalChrome,
    );
    const next = Math.max(
      COMPOSER_MIN_HEIGHT_PX,
      Math.min(el.scrollHeight, maxHeight),
    );
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  useEffect(() => {
    if (!modelOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (modelOpen && !modelRef.current?.contains(t)) setModelOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModelOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [modelOpen]);

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const mode = activeSession?.mode ?? settings?.defaultMode ?? "agent";
  const provider = providers.find(
    (candidate) =>
      candidate.id ===
      (activeSession?.providerId ?? settings?.defaultProviderId),
  );
  const modelId =
    activeSession?.modelId ??
    settings?.defaultModelId ??
    provider?.defaultModelId;
  const thinkingProvider =
    provider &&
    activeSession?.providerId === provider.id &&
    activeSession.modelId === modelId &&
    typeof activeSession.supportsReasoning === "boolean"
      ? {
          ...provider,
          supportsReasoning: activeSession.supportsReasoning,
          supportedThinkingLevels:
            activeSession.supportedThinkingLevels ?? (["off"] as ThinkingLevel[]),
        }
      : provider;
  const sessionThinkingLevel = activeSession?.thinkingLevel;
  const configuredThinkingLevel = isThinkingLevel(sessionThinkingLevel)
    ? sessionThinkingLevel
    : "off";
  const availableThinkingLevels = providerThinkingLevels(thinkingProvider);
  const thinkingLevel = thinkingLevelForProvider(
    thinkingProvider,
    configuredThinkingLevel,
  );
  const thinkingLabel = t(THINKING_LEVEL_I18N_KEYS[thinkingLevel], {
    defaultValue: THINKING_LEVEL_LABELS[thinkingLevel],
  });
  const modelLabel =
    modelId
      ? thinkingProvider?.supportsReasoning
        ? `${modelId} · ${thinkingLabel}`
        : modelId
      : t("chat.model");
  const modelReady =
    !!provider &&
    provider.enabled &&
    !!modelId &&
    (provider.hasSecret || provider.authKind === "none");
  const enterToSend = settings?.enterToSend ?? true;
  const submit = async () => {
    const content = value.trim();
    if (!content || isRunning || !modelReady) return;
    setValue("");
    await sendPrompt(content);
  };

  return (
    <div className={`composer-dock composer-dock-${variant}`}>
      <div className="composer-stack">
        <div className="composer-shell">
          <div className="composer-input-wrap">
            {/* Docked threads carry the brand mark; the empty home keeps a clean draft. */}
            {variant === "docked" ? (
              <span className="composer-thread-mark" aria-hidden>
                <BrandLogo size={15} />
              </span>
            ) : null}
            <textarea
              ref={ref}
              className={variant === "docked" ? "composer-input" : "composer-input composer-input-home"}
              rows={1}
              placeholder={t(variant === "home" ? "chat.placeholderHome" : "chat.placeholder")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && enterToSend) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          </div>

          <div className="composer-toolbar">
            <div className="composer-left">
              <button
                className="icon-btn mode-chip"
                title={t("settings.mode")}
                disabled={isRunning || !activeSession}
                onClick={async () => {
                  const next = mode === "agent" ? "chat" : "agent";
                  try {
                    await configureActiveSession({
                      mode: next,
                      providerId: provider?.id,
                      modelId,
                      thinkingLevel,
                    });
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : String(e), {
                      variant: "error",
                    });
                  }
                }}
              >
                <IconShield size={14} />
                <span className="text-sm">
                  {mode === "chat"
                    ? t("settings.modeChat")
                    : t("settings.modeAgent")}
                </span>
              </button>
            </div>

            <div className="composer-right">
              <div className="composer-model" ref={modelRef}>
                <button
                  className={`icon-btn model-chip ${modelOpen ? "active" : ""}`}
                  title={`${provider?.name || t("chat.provider")} · ${modelLabel}`}
                  aria-haspopup="menu"
                  aria-expanded={modelOpen}
                  disabled={isRunning}
                  onClick={() => setModelOpen((v) => !v)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    useAppStore.getState().setSettingsTab("agent");
                    useAppStore.getState().setPage("settings");
                  }}
                >
                  <span className="max-w-[190px] truncate text-sm leading-none">
                    {modelLabel}
                  </span>
                  <IconChevronDown size={12} />
                </button>
                {modelOpen && (
                  <div className="composer-model-menu" role="menu">
                    <div className="composer-model-heading">
                      <div className="truncate text-sm-plus font-medium text-text-primary">
                        {modelId || t("chat.model")}
                      </div>
                      <div className="truncate text-xs-plus text-text-muted">
                        {provider?.name || t("chat.provider")}
                      </div>
                    </div>
                    <div className="composer-plus-sep" />
                    {providers
                      .filter(
                        (candidate) =>
                          candidate.enabled &&
                          !!candidate.defaultModelId &&
                          (candidate.hasSecret ||
                            candidate.authKind === "none"),
                      )
                      .map((candidate) => (
                      <button
                        key={candidate.id}
                        className={`composer-plus-item ${
                          provider?.id === candidate.id &&
                          modelId === candidate.defaultModelId
                            ? "active"
                            : ""
                        }`}
                        role="menuitemradio"
                        aria-checked={
                          provider?.id === candidate.id &&
                          modelId === candidate.defaultModelId
                        }
                        onClick={async () => {
                          try {
                            await configureActiveSession({
                              mode,
                              providerId: candidate.id,
                              modelId: candidate.defaultModelId,
                              thinkingLevel: thinkingLevelForProvider(
                                candidate,
                                thinkingLevel,
                              ),
                            });
                            setModelOpen(false);
                          } catch (e) {
                            showToast(
                              e instanceof Error ? e.message : String(e),
                              { variant: "error" },
                            );
                          }
                        }}
                      >
                        <span className="truncate">{candidate.name}</span>
                        <span className="ml-auto max-w-[180px] truncate font-mono text-text-secondary">
                          {candidate.defaultModelId}
                        </span>
                      </button>
                    ))}
                    {thinkingProvider?.supportsReasoning && availableThinkingLevels.length ? (
                      <>
                        <div className="composer-plus-sep" />
                        <div className="composer-model-heading">
                          <div className="truncate text-xs-plus font-medium text-text-secondary">
                            {t("chat.thinking", { defaultValue: "Thinking" })}
                          </div>
                        </div>
                        {availableThinkingLevels.map((level) => (
                          <button
                            key={level}
                            className={`composer-plus-item ${
                              thinkingLevel === level ? "active" : ""
                            }`}
                            role="menuitemradio"
                            aria-checked={thinkingLevel === level}
                            onClick={async () => {
                              try {
                                await configureActiveSession({
                                  mode,
                                  providerId: thinkingProvider.id,
                                  modelId,
                                  thinkingLevel: level,
                                });
                                setModelOpen(false);
                              } catch (e) {
                                showToast(
                                  e instanceof Error ? e.message : String(e),
                                  { variant: "error" },
                                );
                              }
                            }}
                          >
                            <span>
                              {t(THINKING_LEVEL_I18N_KEYS[level], {
                                defaultValue: THINKING_LEVEL_LABELS[level],
                              })}
                            </span>
                          </button>
                        ))}
                      </>
                    ) : null}
                    <div className="composer-plus-sep" />
                    <button
                      className="composer-plus-item"
                      role="menuitem"
                      onClick={() => {
                        setModelOpen(false);
                        useAppStore.getState().setSettingsTab("agent");
                        useAppStore.getState().setPage("settings");
                      }}
                    >
                      <span>{t("nav.settings")}</span>
                    </button>
                  </div>
                )}
              </div>

              {isRunning ? (
                <button className="stop-btn" title={t("chat.abort")} onClick={() => void abort()}>
                  <IconStop size={14} />
                </button>
              ) : (
                <button
                  className="send-btn"
                  title={
                    modelReady ? t("chat.send") : t("settings.addProvider")
                  }
                  disabled={!value.trim() || !modelReady}
                  onClick={() => void submit()}
                >
                  <IconArrowUp size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
