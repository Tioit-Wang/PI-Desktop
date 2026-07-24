import { useState } from "react";
import { useAppStore } from "../stores/app-store";

export function Composer() {
  const [value, setValue] = useState("");
  const sendPrompt = useAppStore((s) => s.sendPrompt);
  const abort = useAppStore((s) => s.abort);
  const isRunning = useAppStore((s) => s.isRunning);
  const providers = useAppStore((s) => s.providers);
  const settings = useAppStore((s) => s.settings);
  const hasModel =
    providers.some((p) => p.hasSecret || p.authKind === "none") ||
    Boolean(settings?.defaultModelId);

  const onSend = async () => {
    const content = value.trim();
    if (!content || isRunning || !hasModel) return;
    setValue("");
    await sendPrompt(content);
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-3">
      {!hasModel && (
        <div className="mb-2 rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Configure a model provider and API key in Settings before chatting.
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-[72px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-blue-500 focus:ring-1"
          placeholder="Message PI-Desktop…"
          value={value}
          disabled={!hasModel}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        {isRunning ? (
          <button
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            onClick={() => void abort()}
          >
            Abort
          </button>
        ) : (
          <button
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasModel || !value.trim()}
            onClick={() => void onSend()}
          >
            Send
          </button>
        )}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        Enter to send · Shift+Enter for newline
      </div>
    </div>
  );
}
