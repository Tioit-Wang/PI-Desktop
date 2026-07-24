import { useEffect, useRef, useState } from "react";
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

function projectName(path?: string | null) {
  if (!path) return "No project";
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function Composer() {
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
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMode(settings?.defaultMode ?? "agent");
  }, [settings?.defaultMode]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const provider = providers.find((p) => p.id === settings?.defaultProviderId);
  const modelLabel = settings?.defaultModelId || provider?.defaultModelId || "Model";
  const enterToSend = settings?.enterToSend ?? true;

  const submit = async () => {
    const content = value.trim();
    if (!content || isRunning) return;
    setValue("");
    await sendPrompt(content);
  };

  return (
    <div className="composer-dock">
      <div className="composer-shell">
        <div className="composer-meta">
          <button className="chip" onClick={() => void openProject()} title={workspace?.path ?? "Open project"}>
            <IconFolder size={14} />
            <span className="chip-label">{projectName(workspace?.path)}</span>
          </button>
          <button
            className="chip"
            onClick={() => setToast(workspace?.path ? `Local workspace: ${workspace.path}` : "Open a project first")}
          >
            <IconComputer size={14} />
            <span>Local</span>
          </button>
          <button className="chip" title="Branch context is informational in MVP">
            <IconGitBranch size={14} />
            <span className="chip-label">main</span>
          </button>
        </div>

        <div className="composer-input-wrap">
          <textarea
            ref={ref}
            className="composer-input"
            rows={1}
            placeholder=""
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
              title="Open project"
              onClick={() => void openProject()}
            >
              <IconPlus size={15} />
            </button>
            <button
              className={`icon-btn ${mode === "agent" ? "active" : ""}`}
              title="Permission mode"
              onClick={async () => {
                const next = mode === "agent" ? "chat" : "agent";
                setMode(next);
                if (settings) {
                  try {
                    await api.setSettings({ ...settings, defaultMode: next });
                    setToast(`Mode: ${next}`);
                  } catch (e) {
                    setToast(e instanceof Error ? e.message : String(e));
                  }
                }
              }}
            >
              <IconShield size={14} />
              <span className="text-[12px]">
                {mode === "agent" ? "Agent" : "Chat"}
              </span>
            </button>
          </div>

          <div className="composer-right">
            <button
              className="icon-btn"
              title="Open model settings"
              onClick={() => {
                useAppStore.getState().setSettingsTab("providers");
                useAppStore.getState().setPage("settings");
              }}
            >
              <span className="max-w-[160px] truncate text-[12px] text-text-secondary">
                {provider?.name ? `${provider.name}` : "Provider"} · {modelLabel}
              </span>
            </button>

            {isRunning ? (
              <button className="stop-btn" title="Stop" onClick={() => void abort()}>
                <IconStop size={14} />
              </button>
            ) : (
              <button
                className="send-btn"
                title="Send"
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
  );
}
