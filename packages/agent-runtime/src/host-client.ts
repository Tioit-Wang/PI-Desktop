import { createInterface } from "node:readline";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

export type JsonRpcResult = {
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export class HostClient {
  private child: ChildProcessWithoutNullStreams;
  private pending = new Map<
    string,
    { resolve: (v: JsonRpcResult) => void; reject: (e: Error) => void }
  >();
  private notificationHandlers = new Set<(method: string, params: unknown) => void>();
  private ready: Promise<void>;

  constructor(binaryPath: string, env: Record<string, string | undefined> = {}) {
    this.child = spawn(binaryPath, [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    this.child.stderr.on("data", (buf) => {
      const text = buf.toString("utf8").trim();
      if (text) console.error(`[host-core] ${text}`);
    });

    const rl = createInterface({ input: this.child.stdout });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.id !== undefined && msg.id !== null) {
        const id = String(msg.id);
        const pending = this.pending.get(id);
        if (pending) {
          this.pending.delete(id);
          pending.resolve({ result: msg.result, error: msg.error });
        }
        return;
      }
      if (msg.method) {
        for (const h of this.notificationHandlers) {
          h(msg.method, msg.params);
        }
      }
    });

    this.ready = Promise.resolve();
  }

  onNotification(handler: (method: string, params: unknown) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  async call<T = unknown>(method: string, params: unknown = {}): Promise<T> {
    await this.ready;
    const id = randomUUID();
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    const result = await new Promise<JsonRpcResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(payload, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`host RPC timeout: ${method}`));
        }
      }, 130_000);
    });
    if (result.error) {
      const err = new Error(result.error.message) as Error & {
        code?: number;
        data?: unknown;
      };
      err.code = result.error.code;
      err.data = result.error.data;
      throw err;
    }
    return result.result as T;
  }

  async dispose(): Promise<void> {
    this.child.kill();
  }
}
