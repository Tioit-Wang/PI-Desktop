import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { UiMessage } from "@pi-desktop/shared";
import { Badge } from "./ui";

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

  return (
    <div className="thread-scroll">
      <div className="thread-content">
        {messages
          .filter((message) => {
            if (message.role === "assistant" && !(message.content || "").trim()) {
              return false;
            }
            return true;
          })
          .map((message) => {
          if (message.role === "tool") {
            return (
              <div key={message.id} className="tool-card">
                <div className="tool-card-header">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {message.toolName || "tool"}
                    </span>
                    {message.toolCallId ? (
                      <span className="truncate font-mono text-[11px] text-text-muted">
                        {message.toolCallId}
                      </span>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      message.toolStatus === "error"
                        ? "error"
                        : message.toolStatus === "running"
                          ? "warning"
                          : "success"
                    }
                  >
                    {message.toolStatus || "done"}
                  </Badge>
                </div>
                <div className="tool-card-body">
                  {typeof message.toolResult === "string"
                    ? message.toolResult
                    : message.toolResult
                      ? JSON.stringify(message.toolResult, null, 2)
                      : message.content ||
                        (message.toolArgs
                          ? JSON.stringify(message.toolArgs, null, 2)
                          : "…")}
                </div>
              </div>
            );
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
                    <ReactMarkdown>{message.content || (isRunning ? "…" : "")}</ReactMarkdown>
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
