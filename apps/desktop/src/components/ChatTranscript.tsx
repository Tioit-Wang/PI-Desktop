import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import type { UiMessage } from "@pi-desktop/shared";
import {
  IconArrowDown,
  IconCheck,
  IconChevronRight,
  IconCopy,
} from "./icons";

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

/* One-line hint next to the tool name: prefer a human-readable arg. */
function toolSummary(message: UiMessage) {
  const args = message.toolArgs;
  if (args && typeof args === "object") {
    const rec = args as Record<string, unknown>;
    for (const key of [
      "command",
      "cmd",
      "path",
      "file_path",
      "filePath",
      "url",
      "query",
      "pattern",
      "prompt",
    ]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    try {
      const s = JSON.stringify(rec);
      if (s && s !== "{}") return s;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    });
  }, []);
  return { copied, copy };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy();
  const { t } = useTranslation();
  return (
    <button
      className={`copy-btn ${copied ? "copied" : ""}`}
      title={copied ? t("chat.copied") : label}
      aria-label={label}
      onClick={() => copy(text)}
    >
      {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      <span>{copied ? t("chat.copied") : label}</span>
    </button>
  );
}

/* Markdown <pre> with a hover copy affordance, Codex-style. */
function PreBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const { copied, copy } = useCopy();
  const { t } = useTranslation();
  return (
    <div className="code-block">
      <pre ref={preRef}>{children}</pre>
      <button
        className={`code-copy-btn ${copied ? "copied" : ""}`}
        aria-label={t("chat.copy")}
        title={copied ? t("chat.copied") : t("chat.copy")}
        onClick={() => copy(preRef.current?.innerText ?? "")}
      >
        {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      </button>
    </div>
  );
}

const markdownComponents = { pre: PreBlock };

function ToolRow({ message }: { message: UiMessage }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const body = toolPreview(message);
  const summary = toolSummary(message);
  const status = message.toolStatus;

  return (
    <div className={`tool-row ${open ? "open" : ""}`}>
      <button
        className="tool-row-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tool-row-caret" aria-hidden>
          <IconChevronRight size={12} />
        </span>
        <span className="tool-row-name">{message.toolName || "tool"}</span>
        {summary ? <span className="tool-row-summary">{summary}</span> : null}
        {status === "running" ? (
          <span className="tool-spinner" aria-label={t("chat.running")} />
        ) : status === "error" ? (
          <span className="tool-row-status error">{t("chat.toolFailed")}</span>
        ) : status === "denied" ? (
          <span className="tool-row-status">{t("chat.toolDenied")}</span>
        ) : null}
      </button>
      {open && body ? <div className="tool-row-body">{body}</div> : null}
    </div>
  );
}

/* Shimmering "Working…" line with elapsed time, Codex-style. */
function WorkingIndicator() {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  const time =
    elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`;
  return (
    <div className="working-indicator">
      <span className="shimmer-text">{t("chat.running")}</span>
      {elapsed > 0 ? <span className="working-elapsed">{time}</span> : null}
    </div>
  );
}

const MessageRow = memo(function MessageRow({
  message,
  isRunning,
}: {
  message: UiMessage;
  isRunning: boolean;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const copyLabel = t("chat.copy");
  return (
    <div
      className={`message-row ${isUser ? "user" : message.role}`}
      role="article"
      aria-label={isUser ? "User message" : "Assistant message"}
    >
      <div className="message-col">
        <div className="message-bubble">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown components={markdownComponents}>
                {message.content || (isRunning ? "…" : "")}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {(message.content || "").trim() ? (
          <div className="message-actions">
            <CopyButton text={message.content} label={copyLabel} />
          </div>
        ) : null}
      </div>
    </div>
  );
});

export function ChatTranscript({
  messages,
  isRunning,
}: {
  messages: UiMessage[];
  isRunning: boolean;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Follow the stream only while the user is pinned to the bottom; a manual
  // scroll up pauses following and surfaces the jump-to-latest pill.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    pinnedRef.current = atBottom;
    setShowJump(!atBottom);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) scrollToBottom();
  }, [messages, isRunning, scrollToBottom]);

  const visible = messages.filter((message) => {
    if (message.role === "assistant" && !(message.content || "").trim()) return false;
    return true;
  });

  return (
    <div className="thread-wrap">
      <div
        className="thread-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        <div className="thread-content">
          {visible.map((message) =>
            message.role === "tool" ? (
              <ToolRow key={message.id} message={message} />
            ) : (
              <MessageRow key={message.id} message={message} isRunning={isRunning} />
            ),
          )}
          {isRunning ? <WorkingIndicator /> : null}
        </div>
      </div>
      {showJump ? (
        <button
          className="jump-latest-btn"
          aria-label={t("chat.scrollToBottom")}
          title={t("chat.scrollToBottom")}
          onClick={() => {
            pinnedRef.current = true;
            setShowJump(false);
            scrollToBottom("smooth");
          }}
        >
          <IconArrowDown size={14} />
        </button>
      ) : null}
    </div>
  );
}
