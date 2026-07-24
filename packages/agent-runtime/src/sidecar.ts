/**
 * Node pi agent sidecar.
 * Protocol: NDJSON JSON-RPC on stdio with Electron main.
 * Host access is proxied through main (single host-core process).
 */
import { createInterface } from "node:readline";
import { ParentHostProxy } from "./parent-host-proxy.js";
import { DesktopAgentRuntime } from "./runtime.js";
import type { AgentEventEnvelope, Mode } from "@pi-desktop/shared";

type RuntimeMap = Map<string, DesktopAgentRuntime>;

const runtimes: RuntimeMap = new Map();
const hostProxy = new ParentHostProxy();

function write(msg: unknown) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function notify(method: string, params: unknown) {
  write({ jsonrpc: "2.0", method, params });
}

function respond(id: string | number, result?: unknown, error?: unknown) {
  if (error) write({ jsonrpc: "2.0", id, error });
  else write({ jsonrpc: "2.0", id, result });
}

hostProxy.onNotification((method, params) => {
  if (method === "permissions.request") {
    notify("agent.permission", params);
  }
});

async function handle(method: string, params: any): Promise<unknown> {
  switch (method) {
    case "sidecar.configure": {
      // Main owns host-core; sidecar only keeps config metadata.
      return { ok: true, mode: "host-proxy" };
    }
    case "sidecar.health":
      return { ok: true, runtimes: runtimes.size };
    case "agent.prompt": {
      const sessionId = String(params.sessionId);
      const content = String(params.content ?? "");
      const mode = (params.mode as Mode) || "agent";
      const provider = params.provider as {
        id: string;
        name: string;
        baseUrl?: string;
        modelId: string;
        apiKey: string;
      };
      if (!provider?.apiKey || !provider?.modelId) {
        throw Object.assign(new Error("model/provider not configured"), {
          rpcCode: -32000,
          errorCode: "MODEL_NOT_CONFIGURED",
        });
      }
      // Always recreate runtime for provider/mode changes
      const existing = runtimes.get(sessionId);
      if (existing) {
        await existing.dispose();
        runtimes.delete(sessionId);
      }
      const runtime = new DesktopAgentRuntime({
        host: hostProxy as any,
        sessionId,
        mode,
        provider,
        onEvent: (envelope: AgentEventEnvelope) => {
          notify("agent.event", envelope);
        },
      });
      runtimes.set(sessionId, runtime);
      void runtime.prompt(content).catch((err) => {
        notify("agent.event", {
          sessionId,
          ts: Date.now(),
          event: {
            type: "error",
            error: {
              code: "PROVIDER_ERROR",
              message: err instanceof Error ? err.message : String(err),
              retriable: true,
            },
          },
        });
      });
      return { accepted: true, turnId: "pending" };
    }
    case "agent.abort": {
      const sessionId = String(params.sessionId);
      const runtime = runtimes.get(sessionId);
      if (runtime) await runtime.abort();
      return { ok: true };
    }
    case "agent.getStatus": {
      const sessionId = String(params.sessionId);
      const runtime = runtimes.get(sessionId);
      return {
        status: runtime?.getStatus() ?? {
          sessionId,
          isRunning: false,
          pendingToolConfirmations: 0,
        },
      };
    }
    case "agent.disposeSession": {
      const sessionId = String(params.sessionId);
      const runtime = runtimes.get(sessionId);
      if (runtime) {
        await runtime.dispose();
        runtimes.delete(sessionId);
      }
      return { ok: true };
    }
    default:
      throw Object.assign(new Error(`method not found: ${method}`), {
        rpcCode: -32601,
      });
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  // Responses to host.proxy requests from parent
  if (hostProxy.handleParentMessage(msg)) return;

  if (!msg.method || msg.id === undefined) return;
  try {
    const result = await handle(msg.method, msg.params ?? {});
    respond(msg.id, result);
  } catch (err: any) {
    respond(msg.id, undefined, {
      code: err.rpcCode ?? -32000,
      message: err instanceof Error ? err.message : String(err),
      data: { errorCode: err.errorCode ?? "INTERNAL" },
    });
  }
});

process.stderr.write("[agent-sidecar] ready (host-proxy mode)\n");
