import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { UiMessage } from "@pi-desktop/shared";
import { Badge } from "./ui";

function toolPreview(message: UiMessage) {
  if (typeof message.toolResult === "string" && message.toolResult.trim()) {
    return message.toolResult;
  }
  if (message.toolResult) {
    try {
      return JSON.stringify(message.toolResult, null, 2);
    } catch {
      return String(message.toolResult);
    }
  }
  if (message.content?.trim()) return message.content;
  if (message.toolArgs) {
    try {
      return JSON.stringify(message.toolArgs, null, 2);
    } catch {
      return String(message.toolArgs);
    }
  }
  return "";
}

function ToolCard({ message }: { message: UiMessage }) {
  const [open, setOpen] = useState(false);
  const body = toolPreview(message);
  const tone =
    message.toolStatus === "error"
      ? "error"
      : message.toolStatus === "running"
        ? "warning"
        : "success";

  return (
    <div className="tool-card">
      <button className="tool-card-header" onClick={() => setOpen((v) => !v)}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium text-text-primary">
            {message.toolName || "tool"}
          </span>
          {message.toolCallId ? (
            <span className="truncate font-mono text-[11px] text-text-muted">
              {message.toolCallId.slice(0, 18)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={tone as any}>{message.toolStatus || "done"}</Badge>
          <span className="text-[11px] text-text-muted">{open ? "Hide" : "Show"}</span>
        </div>
      </button>
      {open && body ? <div className="tool-card-body">{body}</div> : null}
    </div>
  );
}

export function ChatTranscript({
  messages,
  isRunning,
}: {
  messages: UiMessage[];
  isRunning: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isRunning]);

  const visible = messages.filter((message) => {
    if (message.role === "assistant" && !(message.content || "").trim()) return false;
    return true;
  });

  return (
    <div className="thread-scroll">
      <div className="thread-content">
        {visible.map((message) => {
          if (message.role === "tool") {
            return <ToolCard key={message.id} message={message} />;
          }

          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={`message-row ${isUser ? "user" : message.role}`}
            >
              <div className="message-bubble">
                {isUser ? (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                  <div className="prose-chat">
                    <ReactMarkdown>
                      {message.content || (isRunning ? "…" : "")}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isRunning ? (
          <div className="py-2 text-[12.5px] text-text-muted animate-pulse-soft">
            Working…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
