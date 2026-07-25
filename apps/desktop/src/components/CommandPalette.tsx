import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAppStore } from "../stores/app-store";
import type { CommandItem } from "@pi-desktop/shared";

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [active, setActive] = useState(0);
  const newSession = useAppStore((s) => s.newSession);
  const openProject = useAppStore((s) => s.openProject);
  const setPage = useAppStore((s) => s.setPage);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const showToast = useAppStore((s) => s.showToast);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    void api.searchCommands("").then((res) => setCommands(res.commands));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void api.searchCommands(query).then((res) => {
        setCommands(res.commands);
        setActive(0);
      });
    }, 80);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  if (!open) return null;

  const run = async (command: CommandItem) => {
    const store = useAppStore.getState();
    try {
      switch (command.id) {
        case "builtin.newChat":
        case "builtin.session.new":
          await newSession();
          break;
        case "builtin.session.delete": {
          const id = store.activeSessionId;
          if (id) {
            await api.deleteSession(id);
            await store.refreshSessions();
            await store.newSession();
          }
          break;
        }
        case "builtin.agent.abort":
          await store.abort();
          break;
        case "builtin.mode.agent":
        case "builtin.mode.chat": {
          const mode = command.id.endsWith("agent") ? "agent" : "chat";
          if (store.settings) {
            const next = { ...store.settings, defaultMode: mode as "agent" | "chat" };
            await api.setSettings(next);
            useAppStore.setState({ settings: next });
          }
          break;
        }
        case "builtin.openProject":
        case "builtin.project.open":
          await openProject();
          break;
        case "builtin.project.clear":
          await store.clearProject();
          break;
        case "builtin.openSettings":
        case "builtin.settings.open":
          setPage("settings");
          break;
        case "builtin.settings.providers":
          setSettingsTab("agent");
          setPage("settings");
          break;
        case "builtin.settings.import":
          setSettingsTab("import");
          setPage("settings");
          break;
        case "builtin.plugins.open":
          setPage("plugins");
          break;
        case "builtin.plugins.loadDev":
          await api.loadDevPlugin();
          await store.refreshPlugins();
          break;
        case "builtin.logs.open":
          await api.openLogs();
          break;
        default:
          await api.executeCommand(command.id);
      }
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog w-full max-w-[560px] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-base outline-none"
          placeholder={t("palette.placeholder")}
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((v) => Math.min(v + 1, Math.max(commands.length - 1, 0)));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((v) => Math.max(v - 1, 0));
            }
            if (e.key === "Enter" && commands[active]) {
              e.preventDefault();
              void run(commands[active]);
            }
          }}
        />
        <div className="max-h-[360px] overflow-auto p-2">
          {commands.length === 0 ? (
            <div className="px-2 py-6 text-center text-md text-text-muted">
              {t("palette.empty")}
            </div>
          ) : (
            commands.map((command, index) => (
              <button
                key={command.id}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-md-plus ${
                  index === active ? "bg-bg-active text-text-primary" : "text-text-secondary hover:bg-bg-hover"
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => void run(command)}
              >
                <span>{command.title}</span>
                <span className="text-xs text-text-muted">{command.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
