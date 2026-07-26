import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, WORK_PANEL_MIN_WIDTH } from "../../stores/app-store";
import type { WorkPanelTab } from "../../stores/app-store";
import { cx } from "../ui";
import {
  IconChevronRight,
  IconClose,
  IconDiff,
  IconFolder,
  IconGlobe,
  IconTerminal,
} from "../icons";
import { ReviewTab } from "./ReviewTab";
import { TerminalTab } from "./TerminalTab";
import { BrowserTab } from "./BrowserTab";
import { FilesTab } from "./FilesTab";

const WORK_PANEL_MAX_WIDTH_RATIO = 0.6;
const MAIN_PANE_MIN_WIDTH = 360;

const TOOL_TABS = [
  { id: "review", Icon: IconDiff },
  { id: "terminal", Icon: IconTerminal },
  { id: "browser", Icon: IconGlobe },
  { id: "files", Icon: IconFolder },
] as const;

function clampWidth(width: number) {
  const sidebar = document.querySelector<HTMLElement>(".sidebar, .sidebar-rail");
  const sidebarWidth = sidebar?.getBoundingClientRect().width ?? 0;
  const mainPaneSafeMax = Math.floor(
    window.innerWidth - sidebarWidth - MAIN_PANE_MIN_WIDTH,
  );
  const max = Math.max(
    WORK_PANEL_MIN_WIDTH,
    Math.min(
      720,
      Math.floor(window.innerWidth * WORK_PANEL_MAX_WIDTH_RATIO),
      mainPaneSafeMax,
    ),
  );
  return Math.max(WORK_PANEL_MIN_WIDTH, Math.min(max, width));
}

function WelcomePane({ onPick }: { onPick: (tab: WorkPanelTab) => void }) {
  const { t } = useTranslation();
  return (
    <div className="work-welcome">
      <h2 className="work-welcome-title">{t("panel.welcome.title")}</h2>
      <p className="work-welcome-subtitle">{t("panel.welcome.subtitle")}</p>
      <div className="work-welcome-menu">
        {TOOL_TABS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            className="work-welcome-item"
            onClick={() => onPick(id)}
          >
            <span className="work-welcome-icon" aria-hidden>
              <Icon size={17} />
            </span>
            <span className="work-welcome-text">
              <span className="work-welcome-name">{t(`panel.tabs.${id}`)}</span>
              <span className="work-welcome-desc">{t(`panel.welcome.${id}`)}</span>
            </span>
            <span className="work-welcome-go" aria-hidden>
              <IconChevronRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkPanel({ browserBlocked = false }: { browserBlocked?: boolean }) {
  const { t } = useTranslation();
  const tab = useAppStore((s) => s.workPanelTab);
  const width = useAppStore((s) => s.workPanelWidth);
  const setTab = useAppStore((s) => s.setWorkPanelTab);
  const setOpen = useAppStore((s) => s.setWorkPanelOpen);
  const setWidth = useAppStore((s) => s.setWorkPanelWidth);

  // Live width during a drag stays local; the store (and localStorage)
  // only sees the committed value on pointer-up.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragState = useRef<{ pointerId: number } | null>(null);

  const onResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragState.current = { pointerId: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragWidth(clampWidth(window.innerWidth - e.clientX));
    },
    [],
  );

  const onResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    setDragWidth(clampWidth(window.innerWidth - e.clientX));
  }, []);

  const onResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return;
      dragState.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setWidth(clampWidth(window.innerWidth - e.clientX));
      setDragWidth(null);
    },
    [setWidth],
  );

  // Re-clamp the persisted width when the window shrinks under it.
  useEffect(() => {
    const onWindowResize = () => {
      const clamped = clampWidth(width);
      if (clamped !== width) setWidth(clamped);
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [width, setWidth]);

  return (
    <aside
      className="work-panel"
      style={{ width: dragWidth ?? width }}
      data-testid="work-panel"
    >
      <div
        className="work-panel-resize no-drag"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
      />
      <div className="work-panel-main">
        <header className="work-panel-header">
          <div className="work-panel-title">
            {tab === "welcome" ? t("panel.title") : t(`panel.tabs.${tab}`)}
          </div>
          <button
            type="button"
            className="icon-btn no-drag"
            onClick={() => setOpen(false)}
            title={t("panel.close")}
          >
            <IconClose size={15} />
          </button>
        </header>
        <div className="work-panel-body">
          {tab === "welcome" && <WelcomePane onPick={setTab} />}
          {tab === "review" && <ReviewTab />}
          {/* The terminal outlives tab switches: hide it instead of unmounting
              so the PTY session and scrollback survive. */}
          <div className={cx("work-panel-tabpane", tab !== "terminal" && "is-hidden")}>
            <TerminalTab active={tab === "terminal"} />
          </div>
          {tab === "browser" && <BrowserTab blocked={browserBlocked} />}
          {tab === "files" && <FilesTab />}
        </div>
      </div>
      <nav className="work-panel-rail no-drag" aria-label={t("panel.title")}>
        {TOOL_TABS.map(({ id, Icon }) => {
          const label = t(`panel.tabs.${id}`);
          return (
            <button
              key={id}
              type="button"
              className={cx("work-panel-rail-btn", tab === id && "active")}
              onClick={() => setTab(id)}
              title={label}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
