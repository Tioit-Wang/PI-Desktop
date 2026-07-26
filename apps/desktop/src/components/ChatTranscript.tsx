import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import type { UiMessage } from "@pi-desktop/shared";
import { ConversationMinimap } from "./ConversationMinimap";
import { Markdown, useCopy } from "./Markdown";
import {
  formatToolDuration,
  getToolAction,
  getToolDisplayName,
  getToolSections,
  getToolSummary,
  type ToolAction,
} from "../lib/tool-display";
import {
  IconArrowDown,
  IconCheck,
  IconCircleAlert,
  IconChevronRight,
  IconCopy,
  IconFileText,
  IconFolder,
  IconGlobe,
  IconPencil,
  IconSearch,
  IconSparkles,
  IconTerminal,
  IconWrench,
} from "./icons";

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

const TOOL_ACTION_KEYS: Record<ToolAction, string> = {
  read: "chat.toolRead",
  list: "chat.toolListed",
  search: "chat.toolSearched",
  write: "chat.toolWrote",
  edit: "chat.toolEdited",
  run: "chat.toolRan",
  fetch: "chat.toolFetched",
  use: "chat.toolUsed",
};

const TOOL_RUNNING_KEYS: Record<ToolAction, string> = {
  read: "chat.toolReading",
  list: "chat.toolListing",
  search: "chat.toolSearching",
  write: "chat.toolWriting",
  edit: "chat.toolEditing",
  run: "chat.toolRunning",
  fetch: "chat.toolFetching",
  use: "chat.toolUsing",
};

function ToolActionIcon({ action }: { action: ToolAction }) {
  const props = { size: 15, "aria-hidden": true };
  switch (action) {
    case "read":
      return <IconFileText {...props} />;
    case "list":
      return <IconFolder {...props} />;
    case "search":
      return <IconSearch {...props} />;
    case "write":
    case "edit":
      return <IconPencil {...props} />;
    case "run":
      return <IconTerminal {...props} />;
    case "fetch":
      return <IconGlobe {...props} />;
    default:
      return <IconWrench {...props} />;
  }
}

function ToolSection({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { copied, copy } = useCopy();
  const { t } = useTranslation();
  return (
    <section className="tool-row-section">
      <div className="tool-row-section-head">
        <span>{label}</span>
        <button
          className={`tool-row-copy ${copied ? "copied" : ""}`}
          aria-label={`${t("chat.copy")} ${label}`}
          title={copied ? t("chat.copied") : t("chat.copy")}
          onClick={() => copy(value)}
        >
          {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
        </button>
      </div>
      <pre className="tool-row-content">{value}</pre>
    </section>
  );
}

function ToolRow({ message }: { message: UiMessage }) {
  const { t } = useTranslation();
  const detailsId = useId();
  const status = message.toolStatus;
  const [open, setOpen] = useState(status === "error");
  const action = getToolAction(message.toolName);
  const actionLabel = t(
    status === "running" ? TOOL_RUNNING_KEYS[action] : TOOL_ACTION_KEYS[action],
  );
  const rawName = getToolDisplayName(message.toolName) || t("chat.tool");
  const summary = getToolSummary(message.toolName, message.toolArgs);
  const { input, output } = getToolSections(message);
  const hasDetails = Boolean(input || output);
  const statusLabel =
    status === "running"
      ? t("chat.running")
      : status === "error"
        ? t("chat.toolFailed")
        : status === "denied"
          ? t("chat.toolDenied")
          : t("chat.toolCompleted");

  useEffect(() => {
    if (status === "error") setOpen(true);
  }, [status]);

  return (
    <div
      className={`tool-row ${open ? "open" : ""} status-${status || "success"}`}
      role="region"
      aria-label={`${t("chat.toolCall")}: ${rawName}, ${statusLabel}`}
    >
      <button
        className="tool-row-header"
        aria-expanded={open}
        aria-controls={hasDetails ? detailsId : undefined}
        disabled={!hasDetails}
        title={summary || rawName}
        onClick={() => hasDetails && setOpen((value) => !value)}
      >
        <span className="tool-row-icon">
          <ToolActionIcon action={action} />
        </span>
        <span className={`tool-row-name ${status === "running" ? "running" : ""}`}>
          {actionLabel}
        </span>
        {summary ? <span className="tool-row-summary">{summary}</span> : null}
        {status === "running" ? (
          <span className="tool-spinner" aria-label={t("chat.running")} />
        ) : status === "error" ? (
          <span className="tool-row-status error" aria-label={t("chat.toolFailed")}>
            <IconCircleAlert size={13} />
            {t("chat.toolFailed")}
          </span>
        ) : status === "denied" ? (
          <span className="tool-row-status">{t("chat.toolDenied")}</span>
        ) : null}
        <span className="sr-only" role="status" aria-live="polite">
          {statusLabel}
        </span>
        {hasDetails ? (
          <span className="tool-row-caret" aria-hidden>
            <IconChevronRight size={12} />
          </span>
        ) : null}
      </button>
      {open && hasDetails ? (
        <div className="tool-row-body" id={detailsId}>
          {output ? <ToolSection label={t("chat.toolOutput")} value={output} /> : null}
          {input ? <ToolSection label={t("chat.toolInput")} value={input} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolActivityGroup({
  messages,
  isActive,
  endedAt,
}: {
  messages: UiMessage[];
  isActive: boolean;
  endedAt?: string;
}) {
  const { t } = useTranslation();
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const wasActiveRef = useRef(isActive);
  const startedAt = Date.parse(messages[0]?.createdAt || "") || now;
  const fallbackEnd =
    Math.max(
      startedAt,
      ...messages.map(
        (message) =>
          Date.parse(message.toolCompletedAt || "") ||
          (Date.parse(message.createdAt) || startedAt) +
            (message.toolDurationMs || 0),
      ),
    );
  const completedAt =
    Date.parse(endedAt || "") ||
    finishedAt ||
    (wasActiveRef.current ? now : fallbackEnd);
  const elapsedSeconds = Math.max(
    0,
    Math.floor(((isActive ? now : completedAt) - startedAt) / 1000),
  );
  const elapsed = formatToolDuration(elapsedSeconds);
  const failed = messages.some((message) => message.toolStatus === "error");
  const label = failed
    ? t("chat.processingFailedAfter", { time: elapsed })
    : isActive
      ? t("chat.processingFor", { time: elapsed })
      : t("chat.processedFor", { time: elapsed });

  useEffect(() => {
    if (wasActiveRef.current && !isActive) setFinishedAt(Date.now());
    wasActiveRef.current = isActive;
    if (!isActive) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  return (
    <div
      className={`tool-activity-group ${open ? "open" : ""} ${
        isActive ? "active" : ""
      } ${failed ? "failed" : ""}`}
    >
      <button
        className="tool-activity-header"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="tool-activity-icon" aria-hidden>
          {failed ? <IconCircleAlert size={14} /> : <IconSparkles size={14} />}
        </span>
        <span className={`tool-activity-label ${isActive ? "running" : ""}`}>
          {label}
        </span>
        <span className="tool-activity-count">
          {t("chat.processingSteps", { count: messages.length })}
        </span>
        <span className="tool-activity-caret" aria-hidden>
          <IconChevronRight size={12} />
        </span>
      </button>
      <div
        className="tool-activity-collapse"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="tool-activity-collapse-inner">
          <div className="tool-activity-body" id={detailsId}>
            {messages.map((message) => (
              <ToolRow key={message.id} message={message} />
            ))}
          </div>
        </div>
      </div>
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
  const time = formatToolDuration(elapsed);
  return (
    <div className="working-indicator">
      <span className="shimmer-text">{t("chat.running")}</span>
      {elapsed > 0 ? <span className="working-elapsed">{time}</span> : null}
    </div>
  );
}

function thinkingText(message: UiMessage): string {
  if (typeof message.thinking !== "string") return "";
  return message.thinking.trim() ? message.thinking : "";
}

/**
 * Reasoning is intentionally rendered in its own disclosure. Keeping it out
 * of the answer bubble means streamed thought cannot alter answer markdown,
 * copy actions, or the conversation minimap semantics.
 */
function ThinkingDisclosure({
  thinking,
  streaming,
}: {
  thinking: string;
  streaming: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(streaming);

  useEffect(() => {
    setOpen(streaming);
  }, [streaming]);

  return (
    <details
      className="mb-3 max-w-full rounded-md-plus border border-border-subtle bg-bg-inset px-3 py-2 text-text-secondary"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        className="cursor-pointer select-none text-sm-plus font-medium text-text-secondary"
        aria-label={t(open ? "chat.thinkingHide" : "chat.thinkingShow")}
      >
        {t("chat.thinking", { defaultValue: "Thinking" })}
      </summary>
      <div className="mt-2 border-t border-border-subtle pt-2">
        <div className="prose-chat text-text-secondary">
          <Markdown source={thinking} />
        </div>
      </div>
    </details>
  );
}

/* Typewriter reveal for streaming assistant messages: incoming chunks
 * accumulate in message.content (the buffer); we surface it a few characters
 * per animation frame, speeding up with backlog so the display never trails
 * far behind. Messages that arrive already complete (history loads) render in
 * full, and reduced-motion users get the buffer verbatim. */
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      reduceMotionQuery.addEventListener("change", onChange);
      return () => reduceMotionQuery.removeEventListener("change", onChange);
    },
    () => reduceMotionQuery.matches,
  );
}

function useTypewriter(message: UiMessage) {
  const target = message.content || "";
  const animate = message.role === "assistant";
  const reduceMotion = usePrefersReducedMotion();
  const everStreamedRef = useRef(message.status === "streaming");
  if (message.status === "streaming") everStreamedRef.current = true;
  const reveal = animate && everStreamedRef.current && !reduceMotion;
  const [visibleLen, setVisibleLen] = useState(() => (reveal ? 0 : target.length));
  const visibleLenRef = useRef(visibleLen);
  const targetRef = useRef(target);
  targetRef.current = target;
  const statusRef = useRef(message.status);
  statusRef.current = message.status;

  useEffect(() => {
    if (!reveal) {
      visibleLenRef.current = target.length;
      setVisibleLen(target.length);
      return;
    }
    let raf = 0;
    const tick = () => {
      const full = targetRef.current;
      const len = visibleLenRef.current;
      if (len < full.length) {
        const backlog = full.length - len;
        const step = Math.max(1, Math.round(backlog / 24));
        const next = Math.min(full.length, len + step);
        visibleLenRef.current = next;
        setVisibleLen(next);
      } else if (statusRef.current !== "streaming") {
        // Caught up and the stream ended — stop until new content arrives
        // (the effect restarts when `target` changes).
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reveal, target]);

  if (!reveal) return target;
  return target.slice(0, Math.min(visibleLen, target.length));
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
  const displayed = useTypewriter(message);
  const thinking = thinkingText(message);
  const hasAnswer = Boolean((message.content || "").trim());
  const showAnswer = isUser || Boolean(displayed) || (!thinking && isRunning);
  return (
    <div
      className={`message-row ${isUser ? "user" : message.role}`}
      data-minimap-id={message.id}
      role="article"
      aria-label={isUser ? t("chat.userMessage") : t("chat.assistantMessage")}
    >
      <div className="message-col">
        {!isUser && thinking ? (
          <ThinkingDisclosure
            thinking={thinking}
            streaming={isRunning && message.status === "streaming"}
          />
        ) : null}
        {showAnswer ? (
          <div className="message-bubble">
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="prose-chat">
                <Markdown source={displayed || (isRunning ? "…" : "")} />
              </div>
            )}
          </div>
        ) : null}
        {hasAnswer ? (
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
  const contentRef = useRef<HTMLDivElement>(null);
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

  // The typewriter reveal grows message height without changing `messages`,
  // so follow content resizes too while pinned to the bottom.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  const visible = messages.filter((message) => {
    if (
      message.role === "assistant" &&
      !(message.content || "").trim() &&
      !thinkingText(message)
    )
      return false;
    return true;
  });
  const minimapMessages = visible.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  const entries: Array<
    | { kind: "message"; message: UiMessage }
    | { kind: "tools"; messages: UiMessage[]; endedAt?: string }
  > = [];
  for (let index = 0; index < visible.length; index += 1) {
    const message = visible[index];
    if (message.role !== "tool") {
      entries.push({ kind: "message", message });
      continue;
    }
    const tools = [message];
    while (visible[index + 1]?.role === "tool") {
      index += 1;
      tools.push(visible[index]);
    }
    entries.push({
      kind: "tools",
      messages: tools,
      endedAt:
        visible[index + 1]?.role === "assistant"
          ? visible[index + 1].createdAt
          : undefined,
    });
  }
  const activeToolGroup =
    isRunning && entries[entries.length - 1]?.kind === "tools";
  const lastVisibleMessage = visible[visible.length - 1];
  const assistantIsAnswering =
    lastVisibleMessage?.role === "assistant" &&
    lastVisibleMessage.status === "streaming" &&
    Boolean(
      (lastVisibleMessage.content || "").trim() ||
        thinkingText(lastVisibleMessage),
    );
  const showWorking =
    isRunning && !activeToolGroup && !assistantIsAnswering;

  return (
    <div className="thread-wrap">
      <ConversationMinimap scrollRef={scrollRef} messages={minimapMessages} />
      <div
        className="thread-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        <div className="thread-content" ref={contentRef}>
          {entries.map((entry, index) =>
            entry.kind === "tools" ? (
              <ToolActivityGroup
                key={`tools-${entry.messages[0].id}`}
                messages={entry.messages}
                endedAt={entry.endedAt}
                isActive={isRunning && index === entries.length - 1}
              />
            ) : (
              <MessageRow
                key={entry.message.id}
                message={entry.message}
                isRunning={isRunning}
              />
            ),
          )}
          {showWorking ? <WorkingIndicator /> : null}
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
