/**
 * Node pi agent sidecar.
 * Protocol: NDJSON JSON-RPC on stdio with Electron main.
 * Host access is proxied through main (single host-core process).
 */
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { ParentHostProxy } from "./parent-host-proxy.js";
import { DesktopAgentRuntime } from "./runtime.js";
import type { AgentEventEnvelope, Mode, UiMessage } from "@pi-desktop/shared";

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
        authKind?: string;
      };
      const pluginTools = (params.pluginTools ?? []) as Array<{
        name: string;
        description?: string;
        parameters?: unknown;
      }>;
      const pluginToolNames = pluginTools.map((t) => t.name);
      if (
        !provider?.modelId ||
        (!provider.apiKey && provider.authKind !== "none")
      ) {
        throw Object.assign(new Error("model/provider not configured"), {
          rpcCode: -32000,
          errorCode: "MODEL_NOT_CONFIGURED",
        });
      }
      // A session runs one turn at a time (AGENT_BUSY, spec 02-agent-runtime).
      // Session isolation: one persistent pi-agent per session — reuse the
      // idle runtime so the session keeps its own context, and recreate only
      // when provider/model/mode changed (seeding from the persisted
      // transcript so no context is lost, and none leaks across sessions).
      const existing = runtimes.get(sessionId);
      if (existing?.getStatus().isRunning) {
        throw Object.assign(new Error("session already has an active turn"), {
          rpcCode: -32000,
          errorCode: "AGENT_BUSY",
        });
      }
      let runtime = existing?.matches(mode, provider, pluginToolNames)
        ? existing
        : undefined;
      if (existing && !runtime) {
        await existing.dispose();
        runtimes.delete(sessionId);
      }
      const turnId = randomUUID();
      if (!runtime) {
        let history: UiMessage[] = [];
        try {
          const detail = await hostProxy.call<{
            session?: { messages?: UiMessage[] } | null;
          }>("session.get", { id: sessionId });
          history = detail?.session?.messages ?? [];
        } catch {
          // history restore is best-effort
        }
        // Main persists the current user message before calling us; drop it
        // from the seed so prompt() doesn't add it to the context twice.
        const last = history[history.length - 1];
        if (last?.role === "user" && last.content === content) {
          history = history.slice(0, -1);
        }
        runtime = new DesktopAgentRuntime({
          host: hostProxy as any,
          sessionId,
          mode,
          provider,
          history,
          pluginTools,
          onEvent: (envelope: AgentEventEnvelope) => {
            notify("agent.event", envelope);
          },
        });
        runtimes.set(sessionId, runtime);
      }
      void runtime.prompt(content).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        let code = "PROVIDER_ERROR";
        let retriable = true;
        if (/\b401\b|\b403\b|unauthorized|invalid[_ ]api[_ ]key/i.test(message)) {
          code = "PROVIDER_UNAUTHORIZED";
          retriable = false;
        } else if (/\b429\b|rate.?limit|quota/i.test(message)) {
          code = "PROVIDER_RATE_LIMITED";
        } else if (/abort/i.test(message)) {
          code = "TURN_ABORTED";
          retriable = false;
        } else if (/stream/i.test(message)) {
          code = "STREAM_FAILED";
        }
        notify("agent.event", {
          sessionId,
          ts: Date.now(),
          event: {
            type: "error",
            error: { code, message, retriable },
          },
        });
      });
      return { accepted: true, turnId };
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
