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

export function IconStop(props: IconProps) {
  return (
    <svg {...base({ ...props, strokeWidth: 0 })}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconComputer(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.75" y="5" width="16.5" height="11" rx="1.8" />
      <path d="M8 19h8M12 16v3" />
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

export function IconCloudDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7.5 17.5c-2.4 0-4.2-1.9-4.2-4.1 0-1.8 1.2-3.4 2.9-3.9.4-2.4 2.5-4.2 5-4.2 2.2 0 4.1 1.4 4.8 3.4 2 .3 3.5 2 3.5 4 0 2.2-1.8 4-4 4H7.5Z" />
      <path d="M12 11.5v5M10 14.5l2 2 2-2" />
    </svg>
  );
}

