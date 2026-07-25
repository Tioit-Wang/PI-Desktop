import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import {
  IconArrowUp,
  IconComputer,
  IconFolder,
  IconGitBranch,
  IconShield,
  IconStop,
  IconChevronDown,
} from "./icons";

const COMPOSER_MIN_HEIGHT_PX = 28;
const COMPOSER_MAX_VISIBLE_ROWS = 7;

function cssPixels(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function projectName(path?: string | null, name?: string | null, fallback = "") {
  if (name) return name;
  if (!path) return fallback;
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function Composer({ variant = "docked" }: { variant?: "home" | "docked" }) {
  const { t } = useTranslation();
  const sendPrompt = useAppStore((s) => s.sendPrompt);
  const abort = useAppStore((s) => s.abort);
  const isRunning = useAppStore((s) => s.isRunning);
  const workspace = useAppStore((s) => s.workspace);
  const settings = useAppStore((s) => s.settings);
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const providers = useAppStore((s) => s.providers);
  const configureActiveSession = useAppStore((s) => s.configureActiveSession);
  const openProject = useAppStore((s) => s.openProject);
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
  const modelLabel =
    modelId || t("chat.model");
  const modelReady =
    !!provider &&
    !!modelId &&
    (provider.hasSecret || provider.authKind === "none");
  const enterToSend = settings?.enterToSend ?? true;
  const branch = workspace?.branch || "main";

  const submit = async () => {
    const content = value.trim();
    if (!content || isRunning || !modelReady) return;
    setValue("");
    await sendPrompt(content);
  };

  return (
    <div className={`composer-dock composer-dock-${variant}`}>
      <div className="composer-stack">
        {/* Codex home-with-project gold shows workspace capsule; bare empty home hides it */}
        {(variant === "docked" || !!workspace?.path) && (
          <div className="composer-chips" role="group" aria-label={t("chat.workspaceContext")}>
            <button
              className="chip"
              onClick={() => void openProject()}
              title={workspace?.path ?? t("project.open")}
            >
              <IconFolder size={14} />
              <span className="chip-label">
                {projectName(workspace?.path, workspace?.name, t("project.none"))}
              </span>
            </button>
            <span className="chip-sep" aria-hidden />
            <span
              className="chip"
              title={
                workspace?.path
                  ? t("chat.localWorkspace", { path: workspace.path })
                  : t("project.open")
              }
            >
              <IconComputer size={14} />
              <span>{t("chat.local")}</span>
            </span>
            <span className="chip-sep" aria-hidden />
            <span
              className="chip"
              title={workspace?.branch ? `${t("chat.branch")} ${workspace.branch}` : t("chat.branch")}
            >
              <IconGitBranch size={14} />
              <span className="chip-label">{branch}</span>
            </span>
          </div>
        )}

        <div className="composer-shell">
          <div className="composer-input-wrap">
            {/* Thread dock keeps ∞ cue; home-with-project gold has plain draft */}
            {variant === "docked" ? (
              <span className="composer-thread-mark" aria-hidden>
                <span className="infinity-mark">∞</span>
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
                        {modelLabel}
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
