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
import { existsSync, mkdirSync } from "node:fs";
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
import { Logger } from "./logger";

let mainWindow: BrowserWindow | null = null;
let host: HostProcess | null = null;
let sidecar: AgentSidecar | null = null;
let quitting = false;
const plugins = new PluginRuntime();

const dataDir =
  process.env.PI_DESKTOP_DATA_DIR || join(homedir(), ".pi-desktop");
const logger = new Logger(
  dataDir,
  process.env.NODE_ENV === "production" ? "info" : "debug",
);

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
        { retriable: e?.data?.retriable === true, details: e?.data },
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

type WindowState = { x: number; y: number; width: number; height: number };

function windowStatePath() {
  return join(dataDir, "window-state.json");
}

async function readWindowState(): Promise<WindowState | null> {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = JSON.parse(await readFile(windowStatePath(), "utf8"));
    const s = {
      x: Number(raw.x),
      y: Number(raw.y),
      width: Number(raw.width),
      height: Number(raw.height),
    };
    if (![s.x, s.y, s.width, s.height].every(Number.isFinite)) return null;
    if (s.width < 960 || s.height < 640) return null;
    return s;
  } catch {
    return null;
  }
}

function writeWindowState(state: WindowState) {
  void (async () => {
    const { writeFile } = await import("node:fs/promises");
    try {
      mkdirSync(dataDir, { recursive: true });
      await writeFile(windowStatePath(), JSON.stringify(state), "utf8");
    } catch {
      // best-effort persistence
    }
  })();
}

async function createWindow() {
  const savedState = await readWindowState();
  mainWindow = new BrowserWindow({
    ...(savedState ?? { width: 1200, height: 800 }),
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#181818" : "#ffffff",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Block navigation away from the app shell (dev server origin or local file).
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devOrigin = process.env.ELECTRON_RENDERER_URL;
    if (devOrigin && url.startsWith(devOrigin)) return;
    event.preventDefault();
    logger.app("warn", "blocked navigation attempt", { data: { url } });
  });

  // Codex-like default footprint. CG bounds are truth under Stage Manager.
  const CODEX_BOUNDS = { x: 40, y: 30, width: 1200, height: 800 } as const;
  let boundsGuard = false;
  let boundsTimer: NodeJS.Timeout | null = null;
  let pinUntil = 0;
  let lastCgAt = 0;
  let lastCg: { x: number; y: number; width: number; height: number } | null = null;
  let missingCgStreak = 0;
  // The CG helper is dev tooling; without it, CG-based shelf detection must
  // stay inert or every machine would look permanently "shelved".
  const cgHelperPath = "/tmp/pi-window-bounds";
  const cgHelperAvailable = existsSync(cgHelperPath);

  const readCgBounds = (): { x: number; y: number; width: number; height: number } | null => {
    if (!cgHelperAvailable) return null;
    // Cache briefly — Stage Manager checks should not spawn tools every frame.
    if (Date.now() - lastCgAt < 700) return lastCg;
    try {
      const out = execFileSync(cgHelperPath, [String(process.pid)], {
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
    if (!cg && cgHelperAvailable) missingCgStreak += 1;
    else missingCgStreak = 0;
    // Tiny/offscreen CG footprint is Stage Manager shelf. Missing CG alone is not
    // conclusive (alwaysOnTop can change window layer); require a short streak.
    const shelved =
      (!!cg && (cg.width < 500 || cg.height < 400 || cg.x < -40)) ||
      (!cg && cgHelperAvailable && missingCgStreak >= 3);
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
  mainWindow.on("restore", () => ensureStableBounds(false));
  mainWindow.on("resize", scheduleBoundsCheck);
  mainWindow.on("move", scheduleBoundsCheck);

  // Persist last good user bounds so relaunch restores them.
  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleStateSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || boundsGuard) return;
      if (mainWindow.isMinimized() || mainWindow.isFullScreen()) return;
      const b = mainWindow.getBounds();
      if (b.width >= 960 && b.height >= 640) writeWindowState(b);
    }, 600);
  };
  mainWindow.on("resize", scheduleStateSave);
  mainWindow.on("move", scheduleStateSave);

  const boundsWatchdog = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(boundsWatchdog);
      return;
    }
    const cg = readCgBounds();
    const electronBounds = mainWindow.getBounds();
    if (!cg && cgHelperAvailable) missingCgStreak += 1;
    else missingCgStreak = 0;
    const shelved =
      (!!cg && (cg.width < 500 || cg.height < 400 || cg.x < -40)) ||
      (!cg && cgHelperAvailable && missingCgStreak >= 3);
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
    // Capture runs need the deterministic Codex footprint; normal launches
    // must respect restored user bounds and only fix real shelf states.
    ensureStableBounds(process.env.PI_DESKTOP_CAPTURE === "1");
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
              // ensure expanded sidebar if rail-only
              if (document.querySelector(".sidebar-rail") && !document.querySelector(".sidebar")) {
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }));
              }
            `);
            await new Promise((r) => setTimeout(r, 400));
            try {
              await mainWindow!.webContents.executeJavaScript(
                `window.__PI_CAPTURE__ = 1; void window.__PI_DESKTOP__?.ensureVisualFixtures?.()`,
              );
            } catch {
              // fixtures optional
            }
            await new Promise((r) => setTimeout(r, 500));
            // Prefer a titled empty recent (Codex gold selects a real title, not "New task").
            try {
              await mainWindow!.webContents.executeJavaScript(`
                (() => {
                  const items = [...document.querySelectorAll('.thread-item .thread-item-main, .thread-item-main, .thread-item')];
                  const prefer =
                    items.find((el) => /同步代码/.test(el.textContent || '')) ||
                    items.find((el) => !/新\s*建\s*任\s*务|New task|未命名/i.test(el.textContent || ''));
                  if (prefer) prefer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                })()
              `);
              await new Promise((r) => setTimeout(r, 450));
            } catch {
              await clickNav("new-task");
              await new Promise((r) => setTimeout(r, 500));
            }
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

const RESTART_WINDOW_MS = 120_000;
const MAX_RESTARTS_PER_WINDOW = 3;
const restartState = {
  host: { count: 0, windowStart: 0 },
  sidecar: { count: 0, windowStart: 0 },
};

function wireHost(h: HostProcess) {
  h.onNotification((method, params) => {
    if (method === "permissions.request") {
      logger.app("info", "permission requested", {
        sessionId: (params as any).sessionId,
        toolCallId: (params as any).toolCallId,
        data: { toolName: (params as any).toolName, risk: (params as any).risk },
      });
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
    } else if (method === "plugins.execute") {
      // Host dispatches plugin_* tools to us; run the plugin JS and answer.
      void (async () => {
        const q = params as {
          executionId: string;
          toolCallId?: string;
          toolName: string;
          args: unknown;
        };
        const tool = plugins.getTools().find((t) => t.fullName === q.toolName);
        let payload: Record<string, unknown>;
        if (!tool) {
          payload = {
            executionId: q.executionId,
            ok: false,
            errorCode: "TOOL_NOT_FOUND",
            content: { error: `plugin tool not loaded: ${q.toolName}` },
          };
        } else {
          try {
            const result = await tool.execute(q.args);
            payload = {
              executionId: q.executionId,
              ok: true,
              content: result ?? null,
            };
          } catch (e) {
            payload = {
              executionId: q.executionId,
              ok: false,
              errorCode: "TOOL_FAILED",
              content: { error: e instanceof Error ? e.message : String(e) },
            };
          }
        }
        logger.app("info", "plugin tool executed", {
          toolCallId: q.toolCallId,
          pluginId: tool?.pluginId,
          data: { toolName: q.toolName, ok: payload.ok === true },
        });
        try {
          await h.call("plugins.resolveExecution", payload);
        } catch (e) {
          logger.app("warn", "plugin execution resolve failed", {
            data: String(e),
          });
        }
        for (const toast of plugins.drainToasts()) {
          sendToRenderer(IPC.event.toast, { message: toast });
        }
      })();
    }
  });
  h.onExit(({ code, signal, intentional }) => {
    if (intentional || quitting) return;
    logger.app("error", "host-core exited unexpectedly", {
      code: ErrorCodes.HOST_UNAVAILABLE,
      data: { exitCode: code, signal },
    });
    sendToRenderer(IPC.event.hostStatus, {
      ok: false,
      component: "host",
      restarting: true,
    });
    void superviseRestart("host");
  });
}

async function startHost(): Promise<void> {
  const h = new HostProcess(dataDir, (text) => logger.child("host", text));
  wireHost(h);
  host = h;
  await h.handshake();
  logger.app("info", "host-core handshake ok");
}

function wireSidecar(s: AgentSidecar) {
  s.onNotification((method, params) => {
    if (method === "agent.event") {
      const envelope = params as AgentEventEnvelope;
      const event = envelope.event;
      if (event.type === "tool_start") {
        logger.app("info", "tool start", {
          sessionId: envelope.sessionId,
          toolCallId: (event as any).toolCallId,
          data: { toolName: (event as any).toolName },
        });
      } else if (event.type === "tool_end") {
        logger.app("info", "tool end", {
          sessionId: envelope.sessionId,
          toolCallId: (event as any).toolCallId,
          data: { isError: (event as any).isError === true },
        });
      }
      sendToRenderer(IPC.event.agentMessage, params);
      persistAgentEvent(envelope);
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
  s.onExit(({ code, signal, intentional }) => {
    if (intentional || quitting) return;
    logger.app("error", "agent sidecar exited unexpectedly", {
      data: { exitCode: code, signal },
    });
    sendToRenderer(IPC.event.hostStatus, {
      ok: false,
      component: "sidecar",
      restarting: true,
    });
    void superviseRestart("sidecar");
  });
}

async function startSidecar(): Promise<void> {
  const s = new AgentSidecar((text) => logger.child("agent", text));
  wireSidecar(s);
  sidecar = s;
  if (host) s.setHost(host);
  await s.call("sidecar.configure", {
    hostBinary: host?.binaryPath,
    dataDir,
  });
  logger.app("info", "agent sidecar configured");
}

function persistAgentEvent(envelope: AgentEventEnvelope) {
  if (!host) return;
  const event = envelope.event;
  if (event.type === "message_end" && event.message.role === "assistant") {
    void host
      .call("session.appendMessage", {
        sessionId: envelope.sessionId,
        message: event.message,
      })
      .catch((e) =>
        logger.app("warn", "assistant message persistence failed", {
          sessionId: envelope.sessionId,
          data: String(e),
        }),
      );
  }
  if (event.type === "tool_end") {
    void host
      .call("session.appendMessage", {
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
      })
      .catch((e) =>
        logger.app("warn", "tool message persistence failed", {
          sessionId: envelope.sessionId,
          toolCallId: (event as any).toolCallId,
          data: String(e),
        }),
      );
  }
}

async function superviseRestart(kind: "host" | "sidecar"): Promise<void> {
  const st = restartState[kind];
  const now = Date.now();
  if (now - st.windowStart > RESTART_WINDOW_MS) {
    st.windowStart = now;
    st.count = 0;
  }
  st.count += 1;
  if (st.count > MAX_RESTARTS_PER_WINDOW) {
    logger.app("error", `${kind} restart limit reached; giving up`, {
      code: ErrorCodes.HOST_UNAVAILABLE,
    });
    sendToRenderer(IPC.event.hostStatus, {
      ok: false,
      component: kind,
      fatal: true,
    });
    return;
  }
  const delay = Math.min(500 * 2 ** (st.count - 1), 4000);
  await new Promise((r) => setTimeout(r, delay));
  if (quitting) return;
  try {
    if (kind === "host") {
      await startHost();
      if (sidecar && host) sidecar.setHost(host);
    } else {
      await startSidecar();
    }
    logger.app("warn", `${kind} restarted after crash`);
    sendToRenderer(IPC.event.hostStatus, {
      ok: true,
      component: kind,
      restarted: true,
    });
  } catch (e) {
    logger.app("error", `${kind} restart failed`, { data: String(e) });
    void superviseRestart(kind);
  }
}

async function bootBackends() {
  mkdirSync(join(dataDir, "logs"), { recursive: true });
  logger.app("info", `app boot ${APP_NAME} ${APP_VERSION}`, {
    data: { protocolVersion: PROTOCOL_VERSION },
  });
  await startHost();
  await startSidecar();

  // Restore enabled plugins
  try {
    const listed = await host!.call<{ plugins: any[] }>("plugins.list");
    for (const p of listed.plugins ?? []) {
      if (p.enabled && p.path) {
        try {
          await plugins.loadFromPath(p.path);
          logger.app("info", "plugin restored", { pluginId: p.id });
        } catch (e) {
          logger.app("error", "plugin restore failed", {
            pluginId: p.id,
            data: String(e),
          });
        }
      }
    }
  } catch (e) {
    logger.app("error", "plugin list failed", { data: String(e) });
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
    const res = await host.call<{ session?: { id?: string } }>(
      "session.create",
      input,
    );
    logger.app("info", "session created", { sessionId: res.session?.id });
    return res;
  });
  handle(IPC.invoke.sessionGet, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("session.get", { id });
  });
  handle(IPC.invoke.sessionDelete, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    const res = await host.call("session.delete", { id });
    // Drop the session's pi-agent so a later session with the same id (or a
    // stale runtime) can't answer with this session's context.
    if (sidecar) {
      await sidecar
        .call("agent.disposeSession", { sessionId: id })
        .catch(() => undefined);
    }
    logger.app("info", "session deleted", { sessionId: id });
    return res;
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
    // Config-level validation first (secret present etc.)
    const local = await host.call<{ ok: boolean; message?: string }>(
      "providers.testConnection",
      { id },
    );
    if (!local.ok) return { ...local, network: "skipped" };
    const detail = await host.call<{ provider?: { baseUrl?: string; authKind?: string } }>(
      "providers.get",
      { id },
    );
    const baseUrl = detail.provider?.baseUrl;
    if (!baseUrl) return { ...local, network: "skipped" };
    const secret = await host.call<{ value?: string }>("providers.getSecret", { id });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
        headers: secret.value ? { Authorization: `Bearer ${secret.value}` } : {},
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          network: "failed",
          status: res.status,
          errorCode: ErrorCodes.PROVIDER_UNAUTHORIZED,
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          network: "failed",
          status: res.status,
          errorCode: ErrorCodes.PROVIDER_RATE_LIMITED,
        };
      }
      return { ok: res.ok, network: res.ok ? "ok" : "failed", status: res.status };
    } catch (e) {
      return {
        ok: false,
        network: "failed",
        errorCode: ErrorCodes.TIMEOUT,
        message: e instanceof Error ? e.message : String(e),
      };
    } finally {
      clearTimeout(timer);
    }
  });
  handle(IPC.invoke.providersListModels, async (providerId?: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("providers.listModels", { providerId });
  });

  // Secret material never crosses to the renderer: set/delete/has only.
  handle(IPC.invoke.secretsSet, async (input: { secretRef: string; value: string }) => {
    if (!host) throw new Error("host unavailable");
    return host.call("secrets.set", {
      secretRef: input?.secretRef,
      value: input?.value,
    });
  });
  handle(IPC.invoke.secretsDelete, async (secretRef: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("secrets.delete", { secretRef });
  });
  handle(IPC.invoke.secretsHas, async (secretRef: string) => {
    if (!host) throw new Error("host unavailable");
    return host.call("secrets.has", { secretRef });
  });

  handle(IPC.invoke.projectGet, async () => {
    if (!host) throw new Error("host unavailable");
    let res = (await host.call("workspace.get")) as {
      workspace: { path: string; name: string } | null;
    };
    // Dev convenience only: never auto-open the app bundle directory as the
    // workspace in a packaged build.
    const seed =
      process.env.PI_DESKTOP_SEED_WORKSPACE ||
      process.env.PI_DESKTOP_WORKSPACE ||
      (app.isPackaged ? "" : join(__dirname, "../../.."));
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
    const modelId = settings.defaultModelId || provider.defaultModelId;
    if (!modelId) {
      throw Object.assign(new Error("No model selected for provider"), {
        errorCode: ErrorCodes.MODEL_NOT_CONFIGURED,
      });
    }

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
        // Registered plugin agent tools join the model's toolset; execution
        // round-trips host -> main (plugins.execute) -> plugin JS.
        pluginTools: plugins.getTools().map((t) => ({
          name: t.fullName,
          description: t.description,
          parameters: t.schema ?? { type: "object", properties: {} },
        })),
      },
    );
    logger.app("info", "prompt accepted", {
      sessionId: req.sessionId,
      turnId: result.turnId,
      data: { providerId: provider.id, modelId },
    });
    return result;
  });

  handle(IPC.invoke.agentAbort, async (req: { sessionId: string }) => {
    if (!sidecar) throw new Error("sidecar unavailable");
    logger.app("info", "prompt aborted", { sessionId: req.sessionId });
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
    logger.app("info", "permission resolved", {
      data: { requestId: resolution.requestId, decision: resolution.decision },
    });
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
    logger.app("info", "plugin enabled", { pluginId: id });
    return res;
  });

  handle(IPC.invoke.pluginDisable, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    await plugins.unload(id);
    logger.app("info", "plugin disabled", { pluginId: id });
    return host.call("plugins.disable", { id });
  });

  handle(IPC.invoke.pluginUninstall, async (id: string) => {
    if (!host) throw new Error("host unavailable");
    await plugins.unload(id);
    logger.app("info", "plugin uninstalled", { pluginId: id });
    return host.call("plugins.uninstall", { id });
  });

  handle(IPC.invoke.commandPaletteSearch, async (query: string) => {
    const q = (query || "").toLowerCase();
    const builtin = [
      { id: "builtin.session.new", title: "New task", category: "Session", keywords: ["new", "chat", "task"], source: "builtin" as const },
      { id: "builtin.session.delete", title: "Delete current task", category: "Session", keywords: ["delete", "remove", "session"], source: "builtin" as const },
      { id: "builtin.agent.abort", title: "Abort current run", category: "Session", keywords: ["stop", "abort", "cancel"], source: "builtin" as const },
      { id: "builtin.mode.agent", title: "Switch to Agent mode", category: "Session", keywords: ["mode", "agent"], source: "builtin" as const },
      { id: "builtin.mode.chat", title: "Switch to Chat mode (read-only)", category: "Session", keywords: ["mode", "chat", "read-only"], source: "builtin" as const },
      { id: "builtin.project.open", title: "Open project", category: "Project", keywords: ["open", "folder", "workspace"], source: "builtin" as const },
      { id: "builtin.project.clear", title: "Clear project", category: "Project", keywords: ["clear", "close", "workspace"], source: "builtin" as const },
      { id: "builtin.settings.open", title: "Open settings", category: "App", keywords: ["settings", "preferences"], source: "builtin" as const },
      { id: "builtin.settings.providers", title: "Open provider settings", category: "Settings", keywords: ["provider", "model", "key"], source: "builtin" as const },
      { id: "builtin.plugins.open", title: "Open plugins", category: "Plugins", keywords: ["plugins", "extensions"], source: "builtin" as const },
      { id: "builtin.plugins.loadDev", title: "Load development plugin", category: "Plugins", keywords: ["load", "dev", "plugin"], source: "builtin" as const },
      { id: "builtin.logs.open", title: "Open logs folder", category: "Diagnostics", keywords: ["logs", "diagnostics"], source: "builtin" as const },
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
}

app.whenReady().then(async () => {
  registerIpc();
  let bootError: unknown = null;
  try {
    await bootBackends();
  } catch (e) {
    bootError = e;
    logger.app("error", "backend boot failed", {
      code: ErrorCodes.HOST_UNAVAILABLE,
      data: String(e),
    });
  }
  await createWindow();
  // createWindow awaits the initial load (loadFile resolves on
  // did-finish-load), so the page is up; give React a beat to mount its
  // event subscriptions before pushing the boot outcome.
  setTimeout(() => {
    sendToRenderer(IPC.event.hostStatus, {
      ok: !bootError,
      ...(bootError
        ? { component: "host", fatal: true, message: String(bootError) }
        : {}),
    });
  }, 300);

  // Headless boot probe for automated e2e (scripts/e2e-electron-boot.mjs):
  // verifies sandboxed preload bridge + a full IPC round-trip, then quits.
  if (process.env.PI_DESKTOP_BOOT_PROBE === "1") {
    setTimeout(() => {
      void (async () => {
        try {
          const probe = await mainWindow!.webContents.executeJavaScript(
            `(async () => {
               const api = window.piDesktop;
               if (!api || typeof api.invoke !== "function") {
                 return { ok: false, reason: "preload api missing" };
               }
               const version = await api.invoke(api.channels.invoke.appGetVersion);
               return {
                 ok: version?.ok === true,
                 version: version?.data?.version,
                 hostProtocol: version?.data?.hostProtocolVersion,
               };
             })()`,
          );
          console.log("BOOT_PROBE", JSON.stringify(probe));
        } catch (e) {
          console.log(
            "BOOT_PROBE",
            JSON.stringify({ ok: false, reason: String(e) }),
          );
        } finally {
          app.quit();
        }
      })();
    }, 800);
  }
  // Supervision probe (scripts/e2e-supervision.mjs): SIGKILL our own
  // host-core child, then assert the supervisor brings a fresh one back
  // that answers RPCs. Deterministic crash-recovery e2e without pid hunts.
  if (process.env.PI_DESKTOP_SUPERVISION_PROBE === "1") {
    const initialHost = host;
    setTimeout(() => {
      logger.app("info", "supervision probe: killing host-core");
      (initialHost as any)?.child?.kill("SIGKILL");
    }, 1500);
    const t0 = Date.now();
    const poll = setInterval(() => {
      void (async () => {
        if (Date.now() - t0 > 30_000) {
          clearInterval(poll);
          console.log(
            "SUPERVISION_PROBE",
            JSON.stringify({ ok: false, reason: "timeout" }),
          );
          app.quit();
          return;
        }
        if (!host || host === initialHost) return;
        try {
          const health = await host.call<{ ok: boolean }>("app.health");
          clearInterval(poll);
          console.log(
            "SUPERVISION_PROBE",
            JSON.stringify({ ok: health.ok === true, restarted: true }),
          );
          app.quit();
        } catch {
          // restart still settling; keep polling
        }
      })();
    }, 500);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  logger.app("info", "app shutdown");
  void host?.dispose();
  void sidecar?.dispose();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
