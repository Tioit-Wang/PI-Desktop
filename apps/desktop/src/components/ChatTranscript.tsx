import ReactMarkdown from "react-markdown";
import type { UiMessage } from "@pi-desktop/shared";

function ToolCard({ message }: { message: UiMessage }) {
  const status = message.toolStatus ?? "running";
  const color =
    status === "success"
      ? "border-green-700/50 bg-green-950/20"
      : status === "error" || status === "denied"
        ? "border-red-700/50 bg-red-950/20"
        : "border-slate-700 bg-slate-900/60";
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${color}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-medium text-slate-200">
          {message.toolName ?? "tool"}
        </div>
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {status}
        </div>
      </div>
      {message.toolArgs != null && (
        <pre className="mb-2 overflow-auto rounded bg-slate-950/70 p-2 text-xs text-slate-400">
          {JSON.stringify(message.toolArgs, null, 2)}
        </pre>
      )}
      {message.content && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-950/70 p-2 text-xs text-slate-300">
          {message.content}
        </pre>
      )}
    </div>
  );
}

export function ChatTranscript({ messages }: { messages: UiMessage[] }) {
  return (
    <div className="flex-1 space-y-4 overflow-auto px-6 py-4">
      {messages.map((message) => {
        if (message.role === "tool") {
          return <ToolCard key={message.id} message={message} />;
        }
        const isUser = message.role === "user";
        return (
          <div
            key={message.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser
                  ? "bg-blue-600 text-white"
                  : "border border-slate-800 bg-slate-900 text-slate-100"
              }`}
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className="prose prose-invert max-w-none prose-p:my-2 prose-pre:bg-slate-950">
                  <ReactMarkdown>{message.content || "…"}</ReactMarkdown>
                </div>
              )}
              {message.status === "streaming" && (
                <div className="mt-1 text-[11px] text-slate-400">streaming…</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
