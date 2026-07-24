import { useEffect, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [active, setActive] = useState(0);
  const newSession = useAppStore((s) => s.newSession);
  const openProject = useAppStore((s) => s.openProject);
  const setPage = useAppStore((s) => s.setPage);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setToast = useAppStore((s) => s.setToast);

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
    try {
      if (command.id === "builtin.newChat") await newSession();
      else if (command.id === "builtin.openSettings") {
        setSettingsTab("providers");
        setPage("settings");
      } else if (command.id === "builtin.openProject") await openProject();
      else await api.executeCommand(command.id);
      onClose();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog w-full max-w-[560px] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-[14px] outline-none"
          placeholder="Search commands…"
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
            <div className="px-2 py-6 text-center text-[13px] text-text-muted">
              No commands
            </div>
          ) : (
            commands.map((command, index) => (
              <button
                key={command.id}
                className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13.5px] ${
                  index === active ? "bg-bg-active text-text-primary" : "text-text-secondary hover:bg-bg-hover"
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => void run(command)}
              >
                <span>{command.title}</span>
                <span className="text-[11px] text-text-muted">{command.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
