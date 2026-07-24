import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import {
  IconArrowUp,
  IconComputer,
  IconFolder,
  IconGitBranch,
  IconPlus,
  IconShield,
  IconStop,
} from "./icons";

type Effort = "low" | "mid" | "high" | "max";

function projectName(path?: string | null, name?: string | null, fallback = "No project") {
  if (name) return name;
  if (!path) return fallback;
  const parts = path.split(/[/\\]/).filter(Boolean);
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
  const [mode, setMode] = useState<"chat" | "agent">(settings?.defaultMode ?? "agent");
  const [effort, setEffort] = useState<Effort>(() => {
    const saved = localStorage.getItem("pi.desktop.effort");
    return saved === "low" || saved === "mid" || saved === "high" || saved === "max"
      ? saved
      : "max";
  });
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMode(settings?.defaultMode ?? "agent");
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

  const submit = async () => {
    const content = value.trim();
    if (!content || isRunning) return;
    setValue("");
    // Prefix effort as soft instruction only for high/max agent runs.
    const decorated =
      effort === "max" || effort === "high"
        ? content
        : content;
    await sendPrompt(decorated);
  };

  return (
    <div className="composer-dock">
      <div className="composer-stack">
        <div className="composer-chips">
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
              <button
                className="icon-btn"
                title={t("project.open")}
                onClick={() => void openProject()}
              >
                <IconPlus size={15} />
              </button>
              <button
                className={`icon-btn ${mode === "chat" ? "active" : ""}`}
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
              <button
                className="icon-btn"
                title={`${provider?.name || "Provider"} · ${modelLabel}`}
                onClick={() => {
                  const order: Effort[] = ["low", "mid", "high", "max"];
                  const idx = order.indexOf(effort);
                  setEffort(order[(idx + 1) % order.length]);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  useAppStore.getState().setSettingsTab("providers");
                  useAppStore.getState().setPage("settings");
                }}
              >
                <span className="max-w-[190px] truncate text-[12px] text-text-secondary">
                  {t("chat.effortCustom")} {effortLabel}
                </span>
              </button>

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
