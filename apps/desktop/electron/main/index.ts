import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
} from "electron";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
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


type ScheduledTaskRecord = {
  id: string;
  title: string;
  prompt: string;
  cadence: "manual" | "hourly" | "daily" | "weekly";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
};

function scheduledPath() {
  return join(dataDir, "scheduled-tasks.json");
}

async function readScheduled(): Promise<ScheduledTaskRecord[]> {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = await readFile(scheduledPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeScheduled(tasks: ScheduledTaskRecord[]) {
  const { writeFile } = await import("node:fs/promises");
  mkdirSync(dataDir, { recursive: true });
  await writeFile(scheduledPath(), JSON.stringify(tasks, null, 2), "utf8");
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
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#181818" : "#ffffff",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
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

  // Codex-like default footprint. CG bounds are truth under Stage Manager.
  const CODEX_BOUNDS = { x: 40, y: 30, width: 1200, height: 800 } as const;
  let boundsGuard = false;
  let boundsTimer: NodeJS.Timeout | null = null;
  let pinUntil = 0;
  let lastCgAt = 0;
  let lastCg: { x: number; y: number; width: number; height: number } | null = null;
  let missingCgStreak = 0;

  const readCgBounds = (): { x: number; y: number; width: number; height: number } | null => {
    // Cache briefly — Stage Manager checks should not spawn tools every frame.
    if (Date.now() - lastCgAt < 700) return lastCg;
    try {
      const helper = "/tmp/pi-window-bounds";
      const out = execFileSync(helper, [String(process.pid)], {
        encoding: "utf8",
        timeout: 800,
      }).trim();
      lastCgAt = Date.now();
      if (!out) {
        lastCg = null;
        return null;
      }
      const [x, y, w, h] = out.split(",").map((n: string) => Number(n));
      if (![x, y, w, h].every((n: number) => Number.isFinite(n))) {
        lastCg = null;
        return null;
      }
      lastCg = { x, y, width: w, height: h };
      return lastCg;
    } catch {
      lastCgAt = Date.now();
      lastCg = null;
      return null;
    }
  };

  const ensureStableBounds = (force = false) => {
    if (!mainWindow || boundsGuard) return;
    const electronBounds = mainWindow.getBounds();
    const cg = readCgBounds();
    if (!cg) missingCgStreak += 1;
    else missingCgStreak = 0;
    // Tiny/offscreen CG footprint is Stage Manager shelf. Missing CG alone is not
    // conclusive (alwaysOnTop can change window layer); require a short streak.
    const shelved =
      (!!cg && (cg.width < 500 || cg.height < 400 || cg.x < -40)) ||
      (!cg && missingCgStreak >= 3);
    const electronTiny =
      electronBounds.width < 500 || electronBounds.height < 400;
    if (!force && !shelved && !electronTiny) return;

    boundsGuard = true;
    try {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.setMinimumSize(960, 640);
      // Prefer normal layer so CG helpers and Stage Manager stay stable.
      mainWindow.setAlwaysOnTop(false);
      mainWindow.show();
      mainWindow.focus();
      mainWindow.moveTop();
      if (shelved) {
        mainWindow.hide();
        mainWindow.setBounds({ ...CODEX_BOUNDS }, false);
        mainWindow.show();
      } else {
        mainWindow.setBounds({ ...CODEX_BOUNDS }, false);
      }
      mainWindow.setSize(CODEX_BOUNDS.width, CODEX_BOUNDS.height, false);
      mainWindow.setPosition(CODEX_BOUNDS.x, CODEX_BOUNDS.y, false);
      // Brief pin only when actively recovering from a shelf.
      if (shelved || electronTiny) {
        mainWindow.setAlwaysOnTop(true, "floating");
        pinUntil = Date.now() + 4000;
      } else {
        pinUntil = 0;
      }
      // bust CG cache after mutation
      lastCgAt = 0;
      console.log("BOUNDS_RESTORE", {
        electron: electronBounds,
        cg,
        shelved,
        afterElectron: mainWindow.getBounds(),
        afterCg: readCgBounds(),
      });
    } finally {
      setTimeout(() => {
        boundsGuard = false;
      }, 350);
    }
  };

  const scheduleBoundsCheck = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => ensureStableBounds(false), 100);
  };

  mainWindow.on("show", () => ensureStableBounds(false));
  mainWindow.on("focus", () => ensureStableBounds(false));
  mainWindow.on("restore", () => ensureStableBounds(true));
  mainWindow.on("resize", scheduleBoundsCheck);
  mainWindow.on("move", scheduleBoundsCheck);

  const boundsWatchdog = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(boundsWatchdog);
      return;
    }
    const cg = readCgBounds();
    const electronBounds = mainWindow.getBounds();
    if (!cg) missingCgStreak += 1;
    else missingCgStreak = 0;
    const shelved =
      (!!cg && (cg.width < 500 || cg.height < 400 || cg.x < -40)) ||
      (!cg && missingCgStreak >= 3);
    const electronTiny =
      electronBounds.width < 500 || electronBounds.height < 400;
    if (shelved || electronTiny) {
      ensureStableBounds(true);
      return;
    }
    if (Date.now() > pinUntil) {
      try {
        mainWindow.setAlwaysOnTop(false);
      } catch {
        // ignore
      }
    }
  }, 1500);
  mainWindow.on("closed", () => clearInterval(boundsWatchdog));

  mainWindow.once("ready-to-show", () => {
    ensureStableBounds(true);
    mainWindow?.show();
    mainWindow?.focus();
    // Burst re-assert only while Stage Manager initially settles / shelves us.
    for (const ms of [100, 250, 500, 1000, 2000, 3500, 5000, 8000, 12000]) {
      setTimeout(() => ensureStableBounds(false), ms);
    }
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
            const setPage = async (page: string) => {
              await mainWindow!.webContents.executeJavaScript(
                `window.__PI_DESKTOP__?.setPage?.(${JSON.stringify(page)})`,
              );
            };
            const setTheme = async (theme: "light" | "dark") => {
              await mainWindow!.webContents.executeJavaScript(
                `window.__PI_DESKTOP__?.setThemeAttr?.(${JSON.stringify(theme)})`,
              );
            };
            // Wait until React leaves the starting gate.
            for (let i = 0; i < 40; i++) {
              const state = await mainWindow!.webContents.executeJavaScript(`({
                readyText: document.body?.innerText?.slice(0,80) || "",
                theme: document.documentElement.dataset.theme || "",
                hasShell: !!document.querySelector(".app-shell"),
                hasSidebar: !!document.querySelector(".sidebar, .sidebar-rail"),
                sidebarClass: document.querySelector(".sidebar, .sidebar-rail")?.className || "",
                navCount: document.querySelectorAll("[data-nav]").length,
              })`);
              console.log("CAPTURE_STATE", i, state);
              if (state.hasShell && state.navCount > 0) break;
              await new Promise((r) => setTimeout(r, 250));
            }
            await mainWindow!.webContents.executeJavaScript(`
              window.__PI_DESKTOP__?.setThemeAttr?.("light");
              window.__PI_DESKTOP__?.setPage?.("chat");
              // Match Codex empty-home gold: no workspace capsule
              void window.__PI_DESKTOP__?.clearProject?.();
              // ensure expanded sidebar if rail-only
              if (document.querySelector(".sidebar-rail") && !document.querySelector(".sidebar")) {
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }));
              }
            `);
            await new Promise((r) => setTimeout(r, 500));
            await clickNav("new-task");
            await new Promise((r) => setTimeout(r, 600));
            // Re-clear after new-task nav in case it restored a workspace seed
            await mainWindow!.webContents.executeJavaScript(
              `void window.__PI_DESKTOP__?.clearProject?.()`,
            );
            await new Promise((r) => setTimeout(r, 300));
            try {
              if (mainWindow!.isMinimized()) mainWindow!.restore();
              mainWindow!.show();
              mainWindow!.focus();
              mainWindow!.moveTop();
            } catch {
              // ignore
            }
            await new Promise((r) => setTimeout(r, 350));
            // Composer visibility probe (empty draft must not collapse)
            const composerProbe = await mainWindow!.webContents.executeJavaScript(`(() => { const ta=document.querySelector("textarea.composer-input"); if(!ta) return null; const r=ta.getBoundingClientRect(); return {value:ta.value, ph:ta.placeholder, h:ta.offsetHeight, y:Math.round(r.y), mark:document.querySelector(".composer-thread-mark")?.textContent||""}; })()`);
            console.log("COMPOSER_PROBE", composerProbe);
            await shot("pi-final");
            // Open composer + menu for chrome parity proof.
            await mainWindow!.webContents.executeJavaScript(`
              (() => {
                const btn = document.querySelector('.composer-plus button, .composer-plus .icon-btn');
                if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              })()
            `);
            await new Promise((r) => setTimeout(r, 250));
            await shot("pi-plus-menu");
            await mainWindow!.webContents.executeJavaScript(`
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            `);
            await mainWindow!.webContents.executeJavaScript(`
              (() => {
                const btn = document.querySelector('.composer-model button, .model-chip');
                if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              })()
            `);
            await new Promise((r) => setTimeout(r, 250));
            await shot("pi-model-menu");
            await mainWindow!.webContents.executeJavaScript(`
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            `);
            // Destination + theme captures (robust via __PI_DESKTOP__ hooks).
            await setTheme("dark");
            await setPage("chat");
            await new Promise((r) => setTimeout(r, 250));
            await shot("pi-dark-home");
            await setPage("projects");
            await new Promise((r) => setTimeout(r, 300));
            await shot("pi-dark-projects");
            await setPage("pulls");
            await new Promise((r) => setTimeout(r, 300));
            await shot("pi-dark-pulls");
            await setPage("settings");
            await new Promise((r) => setTimeout(r, 350));
            await shot("pi-dark-settings");
            await setTheme("light");
            await setPage("pulls");
            await new Promise((r) => setTimeout(r, 450));
            await shot("pi-pulls-live");
            await setPage("projects");
            await new Promise((r) => setTimeout(r, 350));
            await shot("pi-projects-live");
            await setPage("scheduled");
            await new Promise((r) => setTimeout(r, 350));
            await shot("pi-scheduled-live");
            await setPage("plugins");
            await new Promise((r) => setTimeout(r, 350));
            await shot("pi-plugins-live");
            await setPage("settings");
            await new Promise((r) => setTimeout(r, 350));
            await shot("pi-settings-live");
            await setPage("chat");
            await new Promise((r) => setTimeout(r, 250));
            await mainWindow!.webContents.executeJavaScript(`
              document.querySelector('[data-nav="profile"], .footer-profile')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
            `);
            await new Promise((r) => setTimeout(r, 250));
            await shot("pi-profile-menu");
            await setTheme("light");
            await setPage("chat");
            console.log("CAPTURE_DONE");
            await mainWindow!.webContents.executeJavaScript(`
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            `);
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

  handle(IPC.invoke.composerPickFiles, async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "openDirectory", "multiSelections"],
    });
    if (result.canceled) return { paths: [] as string[], canceled: true };
    return { paths: result.filePaths, canceled: false };
  });

  handle(IPC.invoke.composerPickPhotos, async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "heic", "tif", "tiff"] },
      ],
    });
    if (result.canceled) return { paths: [] as string[], canceled: true };
    return { paths: result.filePaths, canceled: false };
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

  handle(IPC.invoke.scheduledList, async () => {
    const tasks = await readScheduled();
    tasks.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return { tasks };
  });
  handle(IPC.invoke.scheduledCreate, async (input: any = {}) => {
    const tasks = await readScheduled();
    const now = new Date().toISOString();
    const title = String(input.title || input.prompt || "Scheduled task").slice(0, 80);
    const prompt = String(input.prompt || "").trim();
    if (!prompt) throw new Error("prompt required");
    const task: ScheduledTaskRecord = {
      id: crypto.randomUUID(),
      title,
      prompt,
      cadence: (input.cadence as ScheduledTaskRecord["cadence"]) || "manual",
      enabled: input.enabled !== false,
      createdAt: now,
      updatedAt: now,
    };
    tasks.unshift(task);
    await writeScheduled(tasks);
    return { task };
  });
  handle(IPC.invoke.scheduledUpdate, async (input: any = {}) => {
    const id = String(input.id || "");
    const tasks = await readScheduled();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error("task not found");
    const now = new Date().toISOString();
    const prev = tasks[idx];
    const next: ScheduledTaskRecord = {
      ...prev,
      title: input.title != null ? String(input.title).slice(0, 80) : prev.title,
      prompt: input.prompt != null ? String(input.prompt) : prev.prompt,
      cadence: input.cadence || prev.cadence,
      enabled: input.enabled != null ? Boolean(input.enabled) : prev.enabled,
      updatedAt: now,
      lastRunAt: input.lastRunAt != null ? String(input.lastRunAt) : prev.lastRunAt,
    };
    tasks[idx] = next;
    await writeScheduled(tasks);
    return { task: next };
  });
  handle(IPC.invoke.scheduledDelete, async (id: string) => {
    const tasks = await readScheduled();
    await writeScheduled(tasks.filter((t) => t.id !== id));
    return { ok: true };
  });
  handle(IPC.invoke.scheduledRun, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    const tasks = await readScheduled();
    const task = tasks.find((t) => t.id === id);
    if (!task) throw new Error("task not found");
    const settings = (await host.call("settings.get")) as any;
    const project = (await host.call("workspace.get")) as {
      workspace?: { path?: string } | null;
    };
    const created = (await host.call("session.create", {
      title: task.title,
      mode: settings?.defaultMode || "chat",
      providerId: settings?.defaultProviderId,
      modelId: settings?.defaultModelId,
      projectPath: project.workspace?.path,
    })) as { session: { id: string } };
    // mark last run
    task.lastRunAt = new Date().toISOString();
    task.updatedAt = task.lastRunAt;
    await writeScheduled(tasks);
    return {
      sessionId: created.session.id,
      prompt: task.prompt,
      task,
    };
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
