import { randomUUID } from "node:crypto";
import type { IPty } from "node-pty";

/**
 * Work panel PTY sessions (D099).
 *
 * One login shell per workspace path, owned by the Electron main process.
 * Sessions survive panel close / tab switches; a bounded replay buffer
 * restores scrollback when the renderer reattaches. Everything dies with
 * the app via disposeAll().
 */

const REPLAY_LIMIT_BYTES = 128 * 1024;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

type PtySession = {
  termId: string;
  cwd: string;
  pty: IPty;
  replay: string;
  exited: boolean;
};

export type PtyEvents = {
  onData: (termId: string, data: string) => void;
  onExit: (termId: string, exitCode: number | null) => void;
};

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private byCwd = new Map<string, string>();
  private events: PtyEvents;

  constructor(events: PtyEvents) {
    this.events = events;
  }

  /** Create a session for `cwd`, or reattach to the live one. */
  async create(input: {
    cwd: string;
    cols?: number;
    rows?: number;
  }): Promise<{ termId: string; replay: string }> {
    const existingId = this.byCwd.get(input.cwd);
    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing && !existing.exited) {
        return { termId: existing.termId, replay: existing.replay };
      }
    }

    // Deferred import: node-pty is a native module; loading it lazily keeps
    // app boot resilient if the binary is missing or incompatible.
    const { spawn } = await import("node-pty");
    const shell = process.env.SHELL || "/bin/zsh";
    const termId = randomUUID();
    const pty = spawn(shell, ["-l"], {
      name: "xterm-256color",
      cwd: input.cwd,
      cols: input.cols ?? DEFAULT_COLS,
      rows: input.rows ?? DEFAULT_ROWS,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      } as Record<string, string>,
    });

    const session: PtySession = { termId, cwd: input.cwd, pty, replay: "", exited: false };
    this.sessions.set(termId, session);
    this.byCwd.set(input.cwd, termId);

    pty.onData((data) => {
      session.replay = (session.replay + data).slice(-REPLAY_LIMIT_BYTES);
      this.events.onData(termId, data);
    });
    pty.onExit(({ exitCode }) => {
      session.exited = true;
      // A dead session must not shadow the cwd for the next create().
      if (this.byCwd.get(session.cwd) === termId) this.byCwd.delete(session.cwd);
      this.sessions.delete(termId);
      this.events.onExit(termId, exitCode ?? null);
    });

    return { termId, replay: "" };
  }

  write(termId: string, data: string): void {
    this.sessions.get(termId)?.pty.write(data);
  }

  resize(termId: string, cols: number, rows: number): void {
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) return;
    const safeCols = Math.max(2, Math.min(500, Math.floor(cols)));
    const safeRows = Math.max(2, Math.min(300, Math.floor(rows)));
    try {
      this.sessions.get(termId)?.pty.resize(safeCols, safeRows);
    } catch {
      // Resizing a just-exited pty throws; harmless.
    }
  }

  dispose(termId: string): void {
    const session = this.sessions.get(termId);
    if (!session) return;
    this.sessions.delete(termId);
    if (this.byCwd.get(session.cwd) === termId) this.byCwd.delete(session.cwd);
    session.exited = true;
    try {
      session.pty.kill();
    } catch {
      // already dead
    }
  }

  disposeAll(): void {
    for (const termId of [...this.sessions.keys()]) this.dispose(termId);
  }
}
