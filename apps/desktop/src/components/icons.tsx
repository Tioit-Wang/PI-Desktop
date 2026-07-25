import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconCompose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
    </svg>
  );
}

export function IconGitBranch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="6" r="2.25" />
      <circle cx="6" cy="18" r="2.25" />
      <circle cx="18" cy="8" r="2.25" />
      <path d="M6 8.25v7.5M8.1 6.8c3.2 0 5.2.7 7.7 2.4" />
    </svg>
  );
}

export function IconPullRequest(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="6" r="2.25" />
      <circle cx="7" cy="18" r="2.25" />
      <circle cx="17" cy="18" r="2.25" />
      <path d="M7 8.25v7.5M17 15.75V10.5A3.5 3.5 0 0 0 13.5 7H11" />
      <path d="m11 4.5 2.5 2.5L11 9.5" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8v4.5l2.75 1.75" />
    </svg>
  );
}

export function IconAt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="3.25" />
      <path d="M15.25 12v1.1a2.15 2.15 0 0 0 4.3 0V12a7.55 7.55 0 1 0-2.9 6" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.47.78.8 1.55.9H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.1Z" />
    </svg>
  );
}

export function IconHelp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.8 9.6a2.4 2.4 0 1 1 3.7 2c-.8.5-1.25.9-1.25 1.8V14" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconPanel(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2" />
      <path d="M14.5 5v14" />
    </svg>
  );
}

export function IconSidebar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2" />
      <path d="M9.5 5v14" />
    </svg>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    </svg>
  );
}

export function IconArrowDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14" />
      <path d="m6.5 13.5 5.5 5.5 5.5-5.5" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5.5 14.5A1.5 1.5 0 0 1 4 13V5.5A1.5 1.5 0 0 1 5.5 4H13a1.5 1.5 0 0 1 1.5 1.5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconStop(props: IconProps) {
  return (
    <svg {...base({ ...props, strokeWidth: 0 })}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconComputer(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M8 8 H4 v4" />
      <path d="M4 8l5 5" />
      <path d="M16 16 h4 v-4" />
      <path d="M20 16l-5-5" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 5 6.5v5.2c0 4.1 2.8 7.1 7 8.8 4.2-1.7 7-4.7 7-8.8V6.5Z" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" />
    </svg>
  );
}

/** Codex settings "Configuration" glyph — dual circular arrows. */
export function IconConfig(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16.5 7.5A6.5 6.5 0 0 0 6.2 9.2" />
      <path d="M6.5 5.5v3.8H10" />
      <path d="M7.5 16.5A6.5 6.5 0 0 0 17.8 14.8" />
      <path d="M17.5 18.5v-3.8H14" />
    </svg>
  );
}

/** VS Code mark used in settings open-target pill. */
export function IconVSCode(props: IconProps) {
  const { size = 14, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...rest}
    >
      <path
        d="M17.5 2.6 21 4.2v15.6l-3.5 1.6-9.2-7.2L3 17V7l5.3-2.8 9.2 7.2V2.6Z"
        fill="#0078D4"
      />
      <path
        d="M17.5 2.6v11.4L8.3 7.2 17.5 2.6Z"
        fill="#0090F1"
        opacity="0.92"
      />
      <path
        d="M8.3 16.8 17.5 21.4V10.6L8.3 16.8Z"
        fill="#0065A9"
        opacity="0.95"
      />
    </svg>
  );
}

export function IconDot(props: IconProps) {
  return (
    <svg {...base({ ...props, strokeWidth: 0 })}>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

/** Codex settings Account trailing mark (arrow only, no box). */
export function IconArrowUpRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function IconCloudDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7.5 17.5c-2.4 0-4.2-1.9-4.2-4.1 0-1.8 1.2-3.4 2.9-3.9.4-2.4 2.5-4.2 5-4.2 2.2 0 4.1 1.4 4.8 3.4 2 .3 3.5 2 3.5 4 0 2.2-1.8 4-4 4H7.5Z" />
      <path d="M12 11.5v5M10 14.5l2 2 2-2" />
    </svg>
  );
}


export function IconImage(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

/** Codex electron home mark (P4s) — cloud ring + glyph. */
export function IconCodexHome(props: IconProps) {
  const size = props.size ?? 56;
  return (
    <svg
      width={size}
      height={size}
      viewBox="149 149 418 418"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M247.429 247.43C257.73 208.911 292.871 180.543 334.638 180.543C359.555 180.543 382.115 190.64 398.449 206.964C405.906 204.97 413.743 203.905 421.829 203.905C471.681 203.906 512.096 244.32 512.096 294.173C512.096 302.259 511.031 310.096 509.037 317.553C525.361 333.887 535.458 356.446 535.458 381.364C535.458 423.131 507.09 458.271 468.571 468.572C458.271 507.091 423.131 535.459 381.364 535.459C356.446 535.459 333.886 525.362 317.552 509.037C310.095 511.031 302.258 512.097 294.172 512.097C244.319 512.097 203.906 471.682 203.906 421.829C203.906 413.743 204.969 405.905 206.963 398.448C190.639 382.115 180.543 359.555 180.543 334.638C180.543 292.871 208.91 257.73 247.429 247.43Z"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinejoin="round"
      />
      <path
        d="M436.706 408.738H370.021"
        stroke="currentColor"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <path
        d="M276.533 309.154L303.468 357.831C304.433 359.575 304.412 361.698 303.414 363.423L276.533 409.854"
        stroke="currentColor"
        strokeWidth="28"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Codex home suggestion: code brackets */
export function IconExplore(props: IconProps) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.2 6.8 3.6 12l4.6 5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 6.8 20.4 12l-4.6 5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.2 6.5 10.8 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Codex home suggestion: hammer */
export function IconBuild(props: IconProps) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.2 4.8c1.8-1.2 4.2-.9 5.5.4 1.3 1.3 1.6 3.7.4 5.5l-3.2-3.2-6.6 6.6c-.4.4-1 .4-1.4 0l-.9-.9c-.4-.4-.4-1 0-1.4l6.6-6.6-3.4-3.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m10.2 13.8-5.4 5.4c-.5.5-1.3.5-1.8 0v0c-.5-.5-.5-1.3 0-1.8l5.4-5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Codex home suggestion: dual refresh arrows */
export function IconReview(props: IconProps) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.2 9.2A6.2 6.2 0 0 1 18 10.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M17.2 7.2v3.6H13.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M16.8 14.8A6.2 6.2 0 0 1 6 13.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M6.8 16.8v-3.6H10.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Codex home suggestion: bug */
export function IconFix(props: IconProps) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 10.2c0-1.8 1.3-3.2 3-3.2s3 1.4 3 3.2v5c0 1.7-1.3 3-3 3s-3-1.3-3-3v-5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.2h6M12 7V4.8M7.2 8.2 5.4 6.6M16.8 8.2l1.8-1.6M5.2 12.2h2.6M16.2 12.2h2.6M5.4 16.2l1.8-1.4M16.8 14.8l1.8 1.4M9.2 18.6 7.6 20M14.8 18.6 16.4 20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconKeyboard(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </svg>
  );
}

export function IconMic(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  );
}

export function IconPlug(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M9 7v4M15 7v4M7 11h10v2a5 5 0 0 1-10 0v-2Z" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.8-3 4-4.5 7-4.5S16.2 16 18 19" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M6 18l2.5-2.5" />
    </svg>
  );
}

export function IconBrowser(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8h18M7 6h.01M10 6h.01" />
    </svg>
  );
}

export function IconHook(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M10 4v8a4 4 0 1 0 4 4" />
      <circle cx="10" cy="4" r="1.5" />
    </svg>
  );
}

export function IconLink(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M9 12a4 4 0 0 1 0-5.7l1.8-1.8a4 4 0 0 1 5.7 5.7L15 12" />
      <path d="M15 12a4 4 0 0 1 0 5.7l-1.8 1.8a4 4 0 1 1-5.7-5.7L9 12" />
    </svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M12 4a8 8 0 1 0 0 16h1.5a2 2 0 0 0 0-4H12" />
      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPerson(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 10.2h.01M15.8 10.2h.01" />
      <path d="M8.8 14.2c1.1 1.3 2.5 2 3.2 2s2.1-.7 3.2-2" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" />
    </svg>
  );
}

export function IconServer(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <path d="M8 7h.01M8 17h.01" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconPet(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <circle cx="8" cy="9" r="2" />
      <circle cx="16" cy="9" r="2" />
      <circle cx="5.5" cy="13.5" r="1.7" />
      <circle cx="18.5" cy="13.5" r="1.7" />
      <path d="M8.5 17.5c1.2-1.4 2.5-2 3.5-2s2.3.6 3.5 2" />
    </svg>
  );
}

export function IconSnapshot(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M20 12a8 8 0 1 1-2.2-5.4" />
      <path d="M20 5.5V12h-6.5" />
    </svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
    </svg>
  );
}


/** Codex recent-row pin */
export function IconPin(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      <path d="M12 17v4" />
      <path d="M8.5 11.5 7 4h10l-1.5 7.5A3.5 3.5 0 0 1 12 15a3.5 3.5 0 0 1-3.5-3.5Z" />
      <path d="M9 4h6" />
    </svg>
  );
}
