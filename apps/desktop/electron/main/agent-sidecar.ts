import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { HostProcess } from "./host-process";

export type SidecarNotificationHandler = (method: string, params: unknown) => void;

function resolveSidecarEntry(): string {
  const candidates = [
    join(process.resourcesPath || "", "agent-runtime/sidecar.js"),
    join(__dirname, "../../../agent-runtime/dist/sidecar.js"),
    join(__dirname, "../../../../packages/agent-runtime/dist/sidecar.js"),
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return join(__dirname, "../../../../packages/agent-runtime/dist/sidecar.js");
}

export class AgentSidecar {
  private child: ChildProcessWithoutNullStreams;
  private pending = new Map<
    string,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  private handlers = new Set<SidecarNotificationHandler>();
  private host: HostProcess | null = null;

  constructor() {
    const entry = resolveSidecarEntry();
    this.child = spawn(process.execPath, [entry], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
      },
    });

    this.child.stderr.on("data", (buf) => {
      const text = String(buf).trim();
      if (text) console.error(`[agent-sidecar] ${text}`);
    });

    const rl = createInterface({ input: this.child.stdout });
    rl.on("line", (line) => void this.onLine(line));
  }

  setHost(host: HostProcess) {
    this.host = host;
    host.onNotification((method, params) => {
      // Forward host notifications to sidecar
      const payload =
        JSON.stringify({
          jsonrpc: "2.0",
          method: "host.notification",
          params: { method, params },
        }) + "\n";
      this.child.stdin.write(payload);
    });
  }

  private async onLine(line: string) {
    if (!line.trim()) return;
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    // Reverse RPC from sidecar → host proxy
    if (msg.method === "host.proxy" && msg.id !== undefined) {
      try {
        if (!this.host) throw new Error("host unavailable");
        const result = await this.host.call(
          msg.params?.method,
          msg.params?.params ?? {},
        );
        this.child.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }) + "\n",
        );
      } catch (e: any) {
        this.child.stdin.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            error: {
              code: e?.code ?? -32000,
              message: e instanceof Error ? e.message : String(e),
              data: e?.data,
            },
          }) + "\n",
        );
      }
      return;
    }

    if (msg.id !== undefined && msg.id !== null && msg.method === undefined) {
      const pending = this.pending.get(String(msg.id));
      if (pending) {
        this.pending.delete(String(msg.id));
        if (msg.error) {
          const err = new Error(msg.error.message) as Error & {
            code?: number;
            data?: unknown;
          };
          err.code = msg.error.code;
          err.data = msg.error.data;
          pending.reject(err);
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Responses to our calls (have id, no method)
    if (msg.id !== undefined && msg.id !== null && !msg.method) {
      const pending = this.pending.get(String(msg.id));
      if (pending) {
        this.pending.delete(String(msg.id));
        if (msg.error) {
          const err = new Error(msg.error.message) as Error & {
            code?: number;
            data?: unknown;
          };
          err.code = msg.error.code;
          err.data = msg.error.data;
          pending.reject(err);
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    if (msg.method) {
      for (const h of this.handlers) h(msg.method, msg.params);
    }
  }

  onNotification(handler: SidecarNotificationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async call<T = unknown>(method: string, params: unknown = {}): Promise<T> {
    const id = randomUUID();
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: any) => void,
        reject,
      });
      this.child.stdin.write(payload, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`sidecar RPC timeout: ${method}`));
        }
      }, 130_000);
    });
  }

  async dispose(): Promise<void> {
    this.child.kill();
  }
}
