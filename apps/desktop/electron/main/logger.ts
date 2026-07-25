import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

// NDJSON file logging per docs/spec/03-runtime/09-logging-and-observability.md.
// Channels: app (main process), host (host-core stderr), agent (sidecar stderr).
// The audit channel lives in host-core SQLite (see spec §3 note).

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = {
  traceId?: string;
  sessionId?: string;
  turnId?: string;
  toolCallId?: string;
  pluginId?: string;
  code?: string;
  data?: unknown;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const KEEP_ROTATED = 2;

const SECRET_KEY_RE = /token|secret|password|api[_-]?key|authorization/i;
const SECRET_VALUE_RE = /\b(sk|rk|pk)-[A-Za-z0-9_-]{10,}\b/g;

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(SECRET_VALUE_RE, "***REDACTED***");
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? "***REDACTED***" : redactValue(v);
    }
    return out;
  }
  return value;
}

export class Logger {
  private dir: string;
  private minLevel: LogLevel;
  private sizes = new Map<string, number>();

  constructor(dataDir: string, minLevel: LogLevel = "info") {
    this.dir = join(dataDir, "logs");
    this.minLevel = minLevel;
    mkdirSync(this.dir, { recursive: true });
  }

  private levelAt(level: LogLevel): number {
    return { debug: 0, info: 1, warn: 2, error: 3 }[level];
  }

  private pathFor(channel: string, index = 0): string {
    return join(this.dir, index === 0 ? `${channel}.log` : `${channel}.${index}.log`);
  }

  private rotateIfNeeded(channel: string) {
    const path = this.pathFor(channel);
    let size = this.sizes.get(channel);
    if (size === undefined) {
      try {
        size = statSync(path).size;
      } catch {
        size = 0;
      }
    }
    if (size < MAX_FILE_BYTES) {
      this.sizes.set(channel, size);
      return;
    }
    try {
      for (let i = KEEP_ROTATED; i >= 1; i--) {
        const from = this.pathFor(channel, i - 1);
        const to = this.pathFor(channel, i);
        if (existsSync(from)) renameSync(from, to);
      }
    } catch {
      // rotation is best-effort; never fail the caller
    }
    this.sizes.set(channel, 0);
  }

  log(
    channel: "app" | "host" | "agent",
    level: LogLevel,
    message: string,
    fields: LogFields = {},
  ) {
    if (this.levelAt(level) < this.levelAt(this.minLevel)) return;
    const record = {
      ts: new Date().toISOString(),
      level,
      channel,
      message: redactValue(message),
      ...(redactValue(fields) as LogFields),
    };
    const line = JSON.stringify(record) + "\n";
    try {
      this.rotateIfNeeded(channel);
      appendFileSync(this.pathFor(channel), line, "utf8");
      this.sizes.set(channel, (this.sizes.get(channel) ?? 0) + line.length);
    } catch {
      // disk trouble must never crash the app
    }
    if (process.env.NODE_ENV !== "production" || level === "error") {
      const mirror = level === "error" ? console.error : console.log;
      mirror(`[${channel}] ${message}`);
    }
  }

  app(level: LogLevel, message: string, fields?: LogFields) {
    this.log("app", level, message, fields);
  }

  /** Wrap a child process stderr line into the channel log. */
  child(channel: "host" | "agent", text: string) {
    for (const raw of text.split("\n")) {
      const lineText = raw.trim();
      if (!lineText) continue;
      this.log(channel, "info", lineText);
    }
  }
}
