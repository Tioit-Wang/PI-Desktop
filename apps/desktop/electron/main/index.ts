import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from "electron";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import {
  APP_NAME,
  APP_VERSION,
  ErrorCodes,
  IPC,
  IPC_WHITELIST,
  PROTOCOL_VERSION,
  err,
  ok,
  type AgentEventEnvelope,
  type Result,
} from "@pi-desktop/shared";
import { HostProcess } from "./host-process";
import { AgentSidecar } from "./agent-sidecar";
import { PluginRuntime } from "./plugin-runtime";

let mainWindow: BrowserWindow | null = null;
let host: HostProcess | null = null;
let sidecar: AgentSidecar | null = null;
const plugins = new PluginRuntime();

const dataDir =
  process.env.PI_DESKTOP_DATA_DIR || join(homedir(), ".pi-desktop");

function sendToRenderer(channel: string, payload: unknown) {
  if (!IPC_WHITELIST.has(channel)) return;
  mainWindow?.webContents.send(channel, payload);
}

function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  return fn()
    .then((data) => ok(data))
    .catch((e: any) =>
      err(
        e?.data?.errorCode || e?.errorCode || ErrorCodes.INTERNAL,
        e instanceof Error ? e.message : String(e),
        { retriable: true, details: e?.data },
      ),
    );
}

async function withGitBranch<T extends { path?: string; name?: string } | null | undefined>(
  workspace: T,
): Promise<T> {
  if (!workspace || !workspace.path) return workspace;
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const head = await readFile(join(workspace.path, ".git/HEAD"), "utf8");
    const match = head.match(/ref:\s*refs\/heads\/(.+)$/m);
    return {
      ...workspace,
      branch: match?.[1]?.trim() || "detached",
    };
  } catch {
    return { ...workspace, branch: undefined };
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#181818",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
    if (process.env.PI_DESKTOP_CAPTURE === "1") {
      setTimeout(() => {
        void (async () => {
          try {
            if (!mainWindow) return;
            const { writeFileSync } = await import("node:fs");
            const shot = async (name: string) => {
              const img = await mainWindow!.webContents.capturePage();
              writeFileSync(`/tmp/codex-screens/${name}.png`, img.toPNG());
              console.log("CAPTURE", name, img.getSize());
            };
            const clickNav = async (nav: string) => {
              await mainWindow!.webContents.executeJavaScript(
                `document.querySelector('[data-nav="${nav}"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
              );
            };
            await shot("pi-final");
            await clickNav("pulls");
            await new Promise((r) => setTimeout(r, 900));
            await shot("pi-pulls-live");
            await clickNav("projects");
            await new Promise((r) => setTimeout(r, 500));
            await shot("pi-projects-live");
          } catch (e) {
            console.error(e);
          }
        })();
      }, 1800);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    if (process.env.PI_DESKTOP_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

async function bootBackends() {
  mkdirSync(join(dataDir, "logs"), { recursive: true });
  host = new HostProcess(dataDir);
  await host.handshake();

  host.onNotification((method, params) => {
    if (method === "permissions.request") {
      const envelope: AgentEventEnvelope = {
        sessionId: (params as any).sessionId,
        ts: Date.now(),
        event: {
          type: "tool_permission_request",
          request: {
            requestId: (params as any).requestId,
            sessionId: (params as any).sessionId,
            toolCallId: (params as any).toolCallId,
            toolName: (params as any).toolName,
            argsPreview: (params as any).argsPreview,
            risk: (params as any).risk,
            reason: (params as any).reason,
          },
        },
      };
      sendToRenderer(IPC.event.agentMessage, envelope);
    }
  });

  sidecar = new AgentSidecar();
  sidecar.setHost(host);
  await sidecar.call("sidecar.configure", {
    hostBinary: host.binaryPath,
    dataDir,
  });
  sidecar.onNotification((method, params) => {
    if (method === "agent.event") {
      sendToRenderer(IPC.event.agentMessage, params);
    } else if (method === "agent.permission") {
      const envelope: AgentEventEnvelope = {
        sessionId: (params as any).sessionId,
        ts: Date.now(),
        event: {
          type: "tool_permission_request",
          request: {
            requestId: (params as any).requestId,
            sessionId: (params as any).sessionId,
            toolCallId: (params as any).toolCallId,
            toolName: (params as any).toolName,
            argsPreview: (params as any).argsPreview,
            risk: (params as any).risk,
            reason: (params as any).reason,
          },
        },
      };
      sendToRenderer(IPC.event.agentMessage, envelope);
    }
  });

  // Restore enabled plugins
  try {
    const listed = await host.call<{ plugins: any[] }>("plugins.list");
    for (const p of listed.plugins ?? []) {
      if (p.enabled && p.path) {
        try {
          await plugins.loadFromPath(p.path);
        } catch (e) {
          console.error("plugin restore failed", p.id, e);
        }
      }
    }
  } catch (e) {
    console.error("plugin list failed", e);
  }
}

function registerIpc() {
  const handle = (channel: string, fn: (...args: any[]) => Promise<any>) => {
    ipcMain.handle(channel, async (_event, ...args) => wrap(() => fn(...args)));
  };

  handle(IPC.invoke.appGetVersion, async () => {
    const hostVersion = host
      ? await host.call<{ version: string; protocolVersion: number }>(
          "app.getVersion",
        )
      : undefined;
    return {
      name: APP_NAME,
      version: APP_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      hostProtocolVersion: hostVersion?.protocolVersion,
      hostVersion: hostVersion?.version,
      platform: process.platform,
      arch: process.arch,
    };
  });

  handle(IPC.invoke.appHealth, async () => {
    if (!host) throw new Error("host unavailable");
    return host.call("app.health");
  });

  handle(IPC.invoke.appGetOnboarding, async () => {
    if (!host) throw new Error("host unavailable");
    return host.call("app.getOnboarding");
  });

  handle(IPC.invoke.appDismissOnboarding, async () => {
    if (!host) throw new Error("host unavailable");
    const settings = await host.call<any>("settings.get");
    await host.call("settings.set", { ...settings, onboardingDismissed: true });
    return { ok: true };
  });

  handle(IPC.invoke.sessionList, async () => {
    if (!host) throw new Error("host unavailable");
    return host.call("session.list");
  });
  handle(IPC.invoke.sessionCreate, async (input = {}) => {
    if (!host) throw new Error("host unavailable");
    return host.call("session.create", input);
  });
  handle(IPC.invoke.sessionGet, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("session.get", { id });
  });
  handle(IPC.invoke.sessionDelete, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("session.delete", { id });
  });
  handle(IPC.invoke.sessionRename, async (id: string, title: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("session.rename", { id, title });
  });

  handle(IPC.invoke.settingsGet, async () => {
    if (!host) throw new Error("host unavailable");
    return host.call("settings.get");
  });
  handle(IPC.invoke.settingsSet, async (settings: unknown) => {
    if (!host) throw new Error("host unavailable");
    return host.call("settings.set", settings);
  });

  handle(IPC.invoke.providersList, async () => {
    if (!host) throw new Error("host unavailable");
    return host.call("providers.list", { includeDisabled: true });
  });
  handle(IPC.invoke.providersCreate, async (input: unknown) => {
    if (!host) throw new Error("host unavailable");
    return host.call("providers.create", input);
  });
  handle(IPC.invoke.providersUpdate, async (input: unknown) => {
    if (!host) throw new Error("host unavailable");
    return host.call("providers.update", input);
  });
  handle(IPC.invoke.providersDelete, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("providers.delete", { id });
  });
  handle(IPC.invoke.providersTest, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("providers.testConnection", { id });
  });
  handle(IPC.invoke.providersListModels, async (providerId?: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("providers.listModels", { providerId });
  });

  handle(IPC.invoke.projectGet, async () => {
    if (!host) throw new Error("host unavailable");
    let res = (await host.call("workspace.get")) as {
      workspace: { path: string; name: string } | null;
    };
    const seed =
      process.env.PI_DESKTOP_SEED_WORKSPACE ||
      process.env.PI_DESKTOP_WORKSPACE ||
      join(__dirname, "../../..");
    if (!res.workspace && seed) {
      try {
        res = (await host.call("workspace.set", { path: seed })) as {
          workspace: { path: string; name: string } | null;
        };
      } catch {
        // ignore seed failures
      }
    }
    return { workspace: await withGitBranch(res.workspace) };
  });
  handle(IPC.invoke.projectOpen, async () => {
    if (!host) throw new Error("host unavailable");
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { workspace: null, canceled: true };
    }
    const res = (await host.call("workspace.set", {
      path: result.filePaths[0],
    })) as { workspace: { path: string; name: string } | null };
    return { workspace: await withGitBranch(res.workspace), canceled: false };
  });
  handle(IPC.invoke.projectSet, async (path: string) => {
    if (!host) throw new Error("host unavailable");
    const res = (await host.call("workspace.set", { path })) as {
      workspace: { path: string; name: string } | null;
    };
    return { workspace: await withGitBranch(res.workspace) };
  });
  handle(IPC.invoke.projectClear, async () => {
    if (!host) throw new Error("host unavailable");
    return host.call("workspace.clear");
  });

  handle(IPC.invoke.pullsList, async () => {
    if (!host) throw new Error("host unavailable");
    const res = (await host.call("workspace.get")) as {
      workspace: { path: string; name: string } | null;
    };
    const cwd = res.workspace?.path;
    if (!cwd) {
      return { pulls: [], error: "NO_WORKSPACE" as const };
    }
    const { spawn } = await import("node:child_process");
    const run = (cmd: string, args: string[]) =>
      new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn(cmd, args, { cwd, env: process.env });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += String(d)));
        child.stderr.on("data", (d) => (stderr += String(d)));
        child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
        child.on("error", (err) =>
          resolve({ code: 1, stdout: "", stderr: String(err) }),
        );
      });
    const result = await run("gh", [
      "pr",
      "list",
      "--limit",
      "30",
      "--json",
      "number,title,url,author,headRefName,baseRefName,updatedAt,isDraft",
    ]);
    if (result.code !== 0) {
      return {
        pulls: [],
        error: result.stderr.trim() || result.stdout.trim() || "GH_FAILED",
      };
    }
    try {
      const pulls = JSON.parse(result.stdout || "[]") as Array<Record<string, unknown>>;
      return {
        pulls: pulls.map((p) => ({
          number: Number(p.number),
          title: String(p.title || ""),
          url: String(p.url || ""),
          author:
            typeof p.author === "object" && p.author
              ? String((p.author as any).login || "")
              : undefined,
          headRefName: p.headRefName ? String(p.headRefName) : undefined,
          baseRefName: p.baseRefName ? String(p.baseRefName) : undefined,
          updatedAt: p.updatedAt ? String(p.updatedAt) : undefined,
          isDraft: Boolean(p.isDraft),
        })),
      };
    } catch (e) {
      return { pulls: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  handle(IPC.invoke.agentPrompt, async (req: {
    sessionId: string;
    content: string;
  }) => {
    if (!host || !sidecar) throw new Error("backend unavailable");
    const settings = await host.call<any>("settings.get");
    const providers = await host.call<{ providers: any[] }>("providers.list", {
      includeDisabled: false,
    });
    const provider =
      providers.providers.find((p) => p.id === settings.defaultProviderId) ||
      providers.providers.find((p) => p.hasSecret) ||
      providers.providers[0];
    if (!provider) {
      throw Object.assign(new Error("No provider configured"), {
        errorCode: ErrorCodes.MODEL_NOT_CONFIGURED,
      });
    }
    const secret = await host.call<{ value?: string }>("providers.getSecret", {
      id: provider.id,
    });
    if (!secret.value && provider.authKind !== "none") {
      throw Object.assign(new Error("Provider API key missing"), {
        errorCode: ErrorCodes.PROVIDER_SECRET_MISSING,
      });
    }
    const modelId =
      settings.defaultModelId || provider.defaultModelId || "mimo-v2.5";

    // Persist user message
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: req.content,
      createdAt: new Date().toISOString(),
      status: "complete" as const,
    };
    await host.call("session.appendMessage", {
      sessionId: req.sessionId,
      message: userMessage,
    });
    sendToRenderer(IPC.event.agentMessage, {
      sessionId: req.sessionId,
      ts: Date.now(),
      event: { type: "message_start", message: userMessage },
    } satisfies AgentEventEnvelope);
    sendToRenderer(IPC.event.agentMessage, {
      sessionId: req.sessionId,
      ts: Date.now(),
      event: { type: "message_end", message: userMessage },
    } satisfies AgentEventEnvelope);

    const result = await sidecar.call<{ accepted: boolean; turnId: string }>(
      "agent.prompt",
      {
        sessionId: req.sessionId,
        content: req.content,
        mode: settings.defaultMode || "agent",
        provider: {
          id: provider.id,
          name: provider.name,
          baseUrl: provider.baseUrl,
          modelId,
          apiKey: secret.value || "",
        },
      },
    );
    return result;
  });

  handle(IPC.invoke.agentAbort, async (req: { sessionId: string }) => {
    if (!sidecar) throw new Error("sidecar unavailable");
    return sidecar.call("agent.abort", req);
  });

  handle(IPC.invoke.agentGetStatus, async (sessionId: string) => {
    if (!sidecar) throw new Error("sidecar unavailable");
    return sidecar.call("agent.getStatus", { sessionId });
  });

  handle(IPC.invoke.toolResolvePermission, async (resolution: {
    requestId: string;
    decision: string;
  }) => {
    if (!host) throw new Error("host unavailable");
    return host.call("permissions.resolve", resolution);
  });

  handle(IPC.invoke.pluginList, async () => {
    if (!host) throw new Error("host unavailable");
    return host.call("plugins.list");
  });

  handle(IPC.invoke.pluginLoadDev, async () => {
    if (!host) throw new Error("host unavailable");
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }
    const path = result.filePaths[0];
    const loaded = await host.call<{ plugin: any }>("plugins.loadDev", { path });
    await plugins.loadFromPath(path);
    for (const toast of plugins.drainToasts()) {
      sendToRenderer(IPC.event.toast, { message: toast });
    }
    return loaded;
  });

  handle(IPC.invoke.pluginEnable, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    const res = await host.call<{ plugin: any }>("plugins.enable", { id });
    if (res.plugin?.path) await plugins.loadFromPath(res.plugin.path);
    return res;
  });

  handle(IPC.invoke.pluginDisable, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    await plugins.unload(id);
    return host.call("plugins.disable", { id });
  });

  handle(IPC.invoke.pluginUninstall, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    await plugins.unload(id);
    return host.call("plugins.uninstall", { id });
  });

  handle(IPC.invoke.commandPaletteSearch, async (query: string) => {
    const q = (query || "").toLowerCase();
    const builtin = [
      {
        id: "builtin.newChat",
        title: "New task",
        category: "Session",
        source: "builtin" as const,
      },
      {
        id: "builtin.openSettings",
        title: "Open settings",
        category: "App",
        source: "builtin" as const,
      },
      {
        id: "builtin.openProject",
        title: "Open project",
        category: "Project",
        source: "builtin" as const,
      },
    ];
    const pluginCmds = plugins.getCommands().map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      keywords: c.keywords,
      source: "plugin" as const,
      pluginId: c.pluginId,
    }));
    return {
      commands: [...builtin, ...pluginCmds].filter((c) => {
        if (!q) return true;
        const hay = `${c.title} ${c.category ?? ""} ${(c as any).keywords?.join(" ") ?? ""}`.toLowerCase();
        return hay.includes(q);
      }),
    };
  });

  handle(IPC.invoke.commandPaletteExecute, async (commandId: string) => {
    if (commandId.startsWith("builtin.")) {
      return { ok: true, commandId };
    }
    const cmd = plugins.getCommands().find((c) => c.id === commandId);
    if (!cmd) throw new Error("command not found");
    await cmd.run();
    for (const toast of plugins.drainToasts()) {
      sendToRenderer(IPC.event.toast, { message: toast });
    }
    return { ok: true, commandId };
  });

  handle(IPC.invoke.logOpenFolder, async () => {
    const logs = join(dataDir, "logs");
    mkdirSync(logs, { recursive: true });
    await shell.openPath(logs);
    return { ok: true, path: logs };
  });

  // Persist assistant messages when events complete
  // (renderer also keeps UI state; main stores final messages opportunistically via sidecar events)
}

// Persist agent message_end events into host DB
function wirePersistence() {
  // no-op placeholder; prompt path already stores user messages.
  // Assistant persistence: listen sidecar events in register phase.
}

app.whenReady().then(async () => {
  registerIpc();
  try {
    await bootBackends();
    sendToRenderer(IPC.event.hostStatus, { ok: true });
  } catch (e) {
    console.error("backend boot failed", e);
  }
  await createWindow();

  // Attach assistant persistence after window exists
  if (sidecar) {
    sidecar.onNotification((method, params) => {
      if (method !== "agent.event" || !host) return;
      const envelope = params as AgentEventEnvelope;
      const event = envelope.event;
      if (event.type === "message_end" && event.message.role === "assistant") {
        void host.call("session.appendMessage", {
          sessionId: envelope.sessionId,
          message: event.message,
        });
      }
      if (event.type === "tool_end") {
        void host.call("session.appendMessage", {
          sessionId: envelope.sessionId,
          message: {
            id: crypto.randomUUID(),
            role: "tool",
            content:
              typeof event.result === "string"
                ? event.result
                : JSON.stringify(event.result),
            createdAt: new Date().toISOString(),
            toolCallId: event.toolCallId,
            toolStatus: event.isError ? "error" : "success",
            toolResult: event.result,
            isError: event.isError,
            status: "complete",
          },
        });
      }
    });
  }
  wirePersistence();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void host?.dispose();
  void sidecar?.dispose();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
