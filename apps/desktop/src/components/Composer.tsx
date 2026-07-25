import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import {
  IconArrowUp,
  IconCamera,
  IconComputer,
  IconFolder,
  IconGitBranch,
  IconImage,
  IconPlus,
  IconShield,
  IconStop,
  IconChevronDown,
} from "./icons";

type Effort = "low" | "mid" | "high" | "max";

function projectName(path?: string | null, name?: string | null, fallback = "No project") {
  if (name) return name;
  if (!path) return fallback;
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function Composer() {
  const { t } = useTranslation();
  const sendPrompt = useAppStore((s) => s.sendPrompt);
  const abort = useAppStore((s) => s.abort);
  const isRunning = useAppStore((s) => s.isRunning);
  const workspace = useAppStore((s) => s.workspace);
  const settings = useAppStore((s) => s.settings);
  const providers = useAppStore((s) => s.providers);
  const openProject = useAppStore((s) => s.openProject);
  const setToast = useAppStore((s) => s.setToast);
  const [value, setValue] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "agent">(settings?.defaultMode ?? "chat");
  const [effort, setEffort] = useState<Effort>(() => {
    const saved = localStorage.getItem("pi.desktop.effort");
    return saved === "low" || saved === "mid" || saved === "high" || saved === "max"
      ? saved
      : "max";
  });
  const ref = useRef<HTMLTextAreaElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(settings?.defaultMode ?? "chat");
  }, [settings?.defaultMode]);

  useEffect(() => {
    localStorage.setItem("pi.desktop.effort", effort);
  }, [effort]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  useEffect(() => {
    if (!plusOpen && !modelOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (plusOpen && !plusRef.current?.contains(t)) setPlusOpen(false);
      if (modelOpen && !modelRef.current?.contains(t)) setModelOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlusOpen(false);
        setModelOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [plusOpen, modelOpen]);

  const provider = providers.find((p) => p.id === settings?.defaultProviderId);
  const modelLabel = settings?.defaultModelId || provider?.defaultModelId || "Model";
  const enterToSend = settings?.enterToSend ?? true;
  const branch = workspace?.branch || "main";

  const effortLabel =
    effort === "low"
      ? t("chat.effortLow")
      : effort === "mid"
        ? t("chat.effortMid")
        : effort === "high"
          ? t("chat.effortHigh")
          : t("chat.effortMax");

  const appendPaths = (paths: string[]) => {
    if (!paths.length) return;
    const block = paths.map((p) => `@${p}`).join(" ");
    setValue((prev) => (prev.trim() ? `${prev.trimEnd()} ${block}` : block));
    setToast(t("chat.filesAttached", { count: paths.length }));
    ref.current?.focus();
  };

  const submit = async () => {
    const content = value.trim();
    if (!content || isRunning) return;
    setValue("");
    await sendPrompt(content);
  };

  return (
    <div className="composer-dock">
      <div className="composer-stack">
        <div className="composer-chips" role="group" aria-label="Workspace context">
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
          <button
            className="chip"
            onClick={() =>
              setToast(
                workspace?.path ? `Local workspace: ${workspace.path}` : t("project.open"),
              )
            }
          >
            <IconComputer size={14} />
            <span>{t("chat.local")}</span>
          </button>
          <span className="chip-sep" aria-hidden />
          <button
            className="chip"
            title={workspace?.branch ? `${t("chat.branch")} ${workspace.branch}` : t("chat.branch")}
            onClick={() =>
              setToast(
                workspace?.branch
                  ? `${t("chat.branch")}: ${workspace.branch}`
                  : "No git branch detected",
              )
            }
          >
            <IconGitBranch size={14} />
            <span className="chip-label">{branch}</span>
          </button>
        </div>

        <div className="composer-shell">
          <div className="composer-input-wrap">
            <div className="composer-thread-mark" aria-hidden>
              <span className="infinity-mark" title="Thread">
                ∞
              </span>
            </div>
            <textarea
              ref={ref}
              className="composer-input"
              rows={1}
              placeholder={t("chat.placeholder")}
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
              <div className="composer-plus" ref={plusRef}>
                <button
                  className={`icon-btn ${plusOpen ? "active" : ""}`}
                  title={t("chat.addFiles")}
                  aria-label={t("chat.addFiles")}
                  aria-expanded={plusOpen}
                  aria-haspopup="menu"
                  onClick={() => setPlusOpen((v) => !v)}
                >
                  <IconPlus size={15} />
                </button>
                {plusOpen && (
                  <div className="composer-plus-menu" role="menu">
                    <button
                      className="composer-plus-item"
                      role="menuitem"
                      onClick={async () => {
                        setPlusOpen(false);
                        try {
                          const res = await api.pickFiles();
                          if (!res.canceled) appendPaths(res.paths);
                        } catch (e) {
                          setToast(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      <IconFolder size={15} />
                      <span>{t("chat.attachFiles")}</span>
                    </button>
                    <button
                      className="composer-plus-item"
                      role="menuitem"
                      onClick={async () => {
                        setPlusOpen(false);
                        try {
                          const res = await api.pickPhotos();
                          if (!res.canceled) appendPaths(res.paths);
                        } catch (e) {
                          setToast(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      <IconImage size={15} />
                      <span>{t("chat.addPhotos")}</span>
                    </button>
                    <button
                      className="composer-plus-item"
                      role="menuitem"
                      onClick={() => {
                        setPlusOpen(false);
                        setToast(t("chat.appshotSoon"));
                      }}
                    >
                      <IconCamera size={15} />
                      <span>{t("chat.captureAppshot")}</span>
                    </button>
                    <div className="composer-plus-sep" />
                    <button
                      className="composer-plus-item"
                      role="menuitem"
                      onClick={() => {
                        setPlusOpen(false);
                        void openProject();
                      }}
                    >
                      <IconComputer size={15} />
                      <span>{t("project.open")}</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                className="icon-btn mode-chip"
                title={t("settings.mode")}
                onClick={async () => {
                  const next = mode === "agent" ? "chat" : "agent";
                  setMode(next);
                  if (settings) {
                    try {
                      await api.setSettings({ ...settings, defaultMode: next });
                    } catch (e) {
                      setToast(e instanceof Error ? e.message : String(e));
                    }
                  }
                }}
              >
                <IconShield size={14} />
                <span className="text-[12px]">
                  {mode === "chat" ? t("chat.requestApproval") : t("chat.agent")}
                </span>
              </button>
            </div>

            <div className="composer-right">
              <div className="composer-model" ref={modelRef}>
                <button
                  className={`icon-btn model-chip ${modelOpen ? "active" : ""}`}
                  title={`${provider?.name || "Provider"} · ${modelLabel}`}
                  aria-haspopup="menu"
                  aria-expanded={modelOpen}
                  onClick={() => setModelOpen((v) => !v)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    useAppStore.getState().setSettingsTab("providers");
                    useAppStore.getState().setPage("settings");
                  }}
                >
                  <span className="max-w-[190px] truncate text-[12px] leading-none">
                    {t("chat.effortCustom")}&nbsp;{effortLabel}
                  </span>
                  <IconChevronDown size={12} />
                </button>
                {modelOpen && (
                  <div className="composer-model-menu" role="menu">
                    <div className="composer-model-heading">
                      <div className="truncate text-[12.5px] font-medium text-text-primary">
                        {modelLabel}
                      </div>
                      <div className="truncate text-[11.5px] text-text-muted">
                        {provider?.name || "Provider"}
                      </div>
                    </div>
                    <div className="composer-plus-sep" />
                    {(
                      [
                        ["low", t("chat.effortLow")],
                        ["mid", t("chat.effortMid")],
                        ["high", t("chat.effortHigh")],
                        ["max", t("chat.effortMax")],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        className={`composer-plus-item ${effort === key ? "active" : ""}`}
                        role="menuitemradio"
                        aria-checked={effort === key}
                        onClick={() => {
                          setEffort(key);
                          setModelOpen(false);
                        }}
                      >
                        <span>{t("chat.effortCustom")}</span>
                        <span className="ml-auto text-text-secondary">{label}</span>
                      </button>
                    ))}
                    <div className="composer-plus-sep" />
                    <button
                      className="composer-plus-item"
                      role="menuitem"
                      onClick={() => {
                        setModelOpen(false);
                        useAppStore.getState().setSettingsTab("providers");
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
                  title={t("chat.send")}
                  disabled={!value.trim()}
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
