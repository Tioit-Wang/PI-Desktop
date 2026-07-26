import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, WORK_PANEL_MIN_WIDTH } from "../../stores/app-store";
import type { WorkPanelTab } from "../../stores/app-store";
import { cx } from "../ui";
import {
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

function clampWidth(width: number) {
  const max = Math.min(720, Math.floor(window.innerWidth * WORK_PANEL_MAX_WIDTH_RATIO));
  return Math.max(WORK_PANEL_MIN_WIDTH, Math.min(max, width));
}

export function WorkPanel() {
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

  const tabs: Array<{
    id: WorkPanelTab;
    label: string;
    Icon: typeof IconDiff;
  }> = [
    { id: "review", label: t("panel.tabs.review"), Icon: IconDiff },
    { id: "terminal", label: t("panel.tabs.terminal"), Icon: IconTerminal },
    { id: "browser", label: t("panel.tabs.browser"), Icon: IconGlobe },
    { id: "files", label: t("panel.tabs.files"), Icon: IconFolder },
  ];

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
      <header className="work-panel-header">
        <nav className="work-panel-tabs no-drag" aria-label={t("panel.title")}>
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={cx("work-panel-tab", tab === id && "active")}
              onClick={() => setTab(id)}
              title={label}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
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
        {tab === "review" && <ReviewTab />}
        {/* The terminal outlives tab switches: hide it instead of unmounting
            so the PTY session and scrollback survive. */}
        <div className={cx("work-panel-tabpane", tab !== "terminal" && "is-hidden")}>
          <TerminalTab active={tab === "terminal"} />
        </div>
        {tab === "browser" && <BrowserTab />}
        {tab === "files" && <FilesTab />}
      </div>
    </aside>
  );
}
