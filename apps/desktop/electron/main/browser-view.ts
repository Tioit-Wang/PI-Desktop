import { shell, WebContentsView } from "electron";
import type { BrowserWindow } from "electron";
import type { BrowserState } from "@pi-desktop/shared";

/**
 * Work panel embedded preview browser (D100, ADR 0019).
 *
 * A single WebContentsView owned by the main process, attached to the main
 * window and positioned from renderer-measured bounds. The renderer is the
 * visibility authority: it hides the view whenever the browser tab is not
 * the active panel surface or a blocking overlay opens (the view always
 * composites above renderer content).
 */

const PARTITION = "persist:work-browser";

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export class BrowserPane {
  private view: WebContentsView | null = null;
  private window: BrowserWindow | null = null;
  private visible = false;
  private bounds = { x: 0, y: 0, width: 0, height: 0 };
  private onState: (state: BrowserState) => void;

  constructor(onState: (state: BrowserState) => void) {
    this.onState = onState;
  }

  setWindow(window: BrowserWindow | null): void {
    if (this.window === window) return;
    this.detach();
    this.window = window;
  }

  getState(): BrowserState | null {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return null;
    return {
      url: wc.getURL(),
      title: wc.getTitle(),
      isLoading: wc.isLoading(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    };
  }

  navigate(raw: string): BrowserState | null {
    const url = normalizeUrl(raw);
    if (!url) return this.getState();
    const view = this.ensureView();
    void view.webContents.loadURL(url).catch(() => {
      // Navigation failures surface through did-fail-load → state push.
    });
    if (this.visible) this.attach();
    return this.getState();
  }

  action(action: "back" | "forward" | "reload" | "stop"): void {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    if (action === "back" && wc.navigationHistory.canGoBack()) {
      wc.navigationHistory.goBack();
    } else if (action === "forward" && wc.navigationHistory.canGoForward()) {
      wc.navigationHistory.goForward();
    } else if (action === "reload") {
      wc.reload();
    } else if (action === "stop") {
      wc.stop();
    }
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    const safe = {
      x: Math.max(0, Math.round(Number(bounds.x) || 0)),
      y: Math.max(0, Math.round(Number(bounds.y) || 0)),
      width: Math.max(0, Math.round(Number(bounds.width) || 0)),
      height: Math.max(0, Math.round(Number(bounds.height) || 0)),
    };
    this.bounds = safe;
    if (this.view && this.visible) this.view.setBounds(safe);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!this.view) return;
    if (visible) this.attach();
    else this.detach();
  }

  openExternal(): void {
    const url = this.view?.webContents.getURL();
    if (url) void shell.openExternal(url);
  }

  dispose(): void {
    this.detach();
    if (this.view) {
      this.view.webContents.close();
      this.view = null;
    }
  }

  private attach(): void {
    if (!this.window || this.window.isDestroyed() || !this.view) return;
    const children = this.window.contentView.children;
    if (!children.includes(this.view)) {
      this.window.contentView.addChildView(this.view);
    }
    this.view.setBounds(this.bounds);
  }

  private detach(): void {
    if (!this.window || this.window.isDestroyed() || !this.view) return;
    const children = this.window.contentView.children;
    if (children.includes(this.view)) {
      this.window.contentView.removeChildView(this.view);
    }
  }

  private ensureView(): WebContentsView {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        partition: PARTITION,
      },
    });
    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
    wc.session.setPermissionRequestHandler((_wc, _permission, callback) => {
      callback(false);
    });
    wc.on("will-navigate", (event, url) => {
      if (!/^https?:/i.test(url)) event.preventDefault();
    });
    const push = () => {
      const state = this.getState();
      if (state) this.onState(state);
    };
    wc.on("did-start-loading", push);
    wc.on("did-stop-loading", push);
    wc.on("did-navigate", push);
    wc.on("did-navigate-in-page", push);
    wc.on("page-title-updated", push);
    wc.on("did-fail-load", push);
    this.view = view;
    return view;
  }
}
