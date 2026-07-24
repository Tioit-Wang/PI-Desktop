import { useEffect, useState } from "react";
import type { CommandItem } from "@pi-desktop/shared";
import { api } from "../lib/api";
import { useAppStore } from "../stores/app-store";

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const openProject = useAppStore((s) => s.openProject);

  useEffect(() => {
    if (!open) return;
    void api.searchCommands(query).then((r) => setCommands(r.commands));
  }, [open, query]);

  if (!open) return null;

  const run = async (cmd: CommandItem) => {
    if (cmd.id === "builtin.newChat") await newSession();
    else if (cmd.id === "builtin.openSettings") setPage("settings");
    else if (cmd.id === "builtin.openProject") await openProject();
    else await api.executeCommand(cmd.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <input
          autoFocus
          className="w-full border-b border-slate-800 bg-transparent px-4 py-3 text-sm outline-none"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="max-h-80 overflow-auto p-2">
          {commands.map((cmd) => (
            <button
              key={cmd.id}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-800"
              onClick={() => void run(cmd)}
            >
              <span>{cmd.title}</span>
              <span className="text-xs text-slate-500">
                {cmd.category ?? cmd.source}
              </span>
            </button>
          ))}
          {commands.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No commands
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
