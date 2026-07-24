import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatTranscript } from "./components/ChatTranscript";
import { Composer } from "./components/Composer";
import { OnboardingChecklist } from "./components/OnboardingChecklist";
import { PermissionDialog } from "./components/PermissionDialog";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPage } from "./pages/SettingsPage";
import { useAppStore } from "./stores/app-store";
import { api } from "./lib/api";

export default function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const ready = useAppStore((s) => s.ready);
  const page = useAppStore((s) => s.page);
  const messages = useAppStore((s) => s.messages);
  const healthOk = useAppStore((s) => s.healthOk);
  const version = useAppStore((s) => s.version);
  const error = useAppStore((s) => s.error);
  const toast = useAppStore((s) => s.toast);
  const setToast = useAppStore((s) => s.setToast);
  const handleAgentEvent = useAppStore((s) => s.handleAgentEvent);
  const workspace = useAppStore((s) => s.workspace);
  const settings = useAppStore((s) => s.settings);
  const isRunning = useAppStore((s) => s.isRunning);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void bootstrap();
    const offEvent = api.onAgentEvent(handleAgentEvent);
    const offToast = api.onToast((message) => {
      setToast(message);
      setTimeout(() => setToast(null), 2500);
    });
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offEvent();
      offToast();
      window.removeEventListener("keydown", onKey);
    };
  }, [bootstrap, handleAgentEvent, setToast]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Starting PI-Desktop…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 ${
                healthOk ? "text-green-400" : "text-red-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  healthOk ? "bg-green-400" : "bg-red-400"
                }`}
              />
              {healthOk ? "Host connected" : "Host unavailable"}
            </span>
            <span>{workspace?.name ?? "No project"}</span>
            <span>{settings?.defaultModelId ?? "No model"}</span>
            <span className="uppercase">{settings?.defaultMode ?? "agent"}</span>
            {isRunning && <span className="text-blue-400">Running…</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800"
              onClick={() => setPaletteOpen(true)}
            >
              ⌘K
            </button>
            <span>
              {version?.name} {version?.version}
            </span>
          </div>
        </header>

        {page === "settings" ? (
          <SettingsPage />
        ) : (
          <>
            {messages.length === 0 && <OnboardingChecklist />}
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <h2 className="text-xl font-semibold text-slate-100">
                  Start a conversation
                </h2>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Configure a provider, open a project, then send your first prompt.
                </p>
              </div>
            ) : (
              <ChatTranscript messages={messages} />
            )}
            {error && (
              <div className="mx-4 mb-2 rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            <Composer />
          </>
        )}
      </main>

      <PermissionDialog />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {toast && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
