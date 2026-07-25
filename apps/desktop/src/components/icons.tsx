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

/** Codex electron home mark (P4s) — cloud ring + glyph, sized via CSS. */
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
      <mask id="codex-home-icon-mask" fill="white">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M247.429 247.43C257.73 208.911 292.871 180.543 334.638 180.543C359.555 180.543 382.115 190.64 398.449 206.964C405.906 204.97 413.743 203.905 421.829 203.905C471.681 203.906 512.096 244.32 512.096 294.173C512.096 302.259 511.031 310.096 509.037 317.553C525.361 333.887 535.458 356.446 535.458 381.364C535.458 423.131 507.09 458.271 468.571 468.572C458.271 507.091 423.131 535.459 381.364 535.459C356.446 535.459 333.886 525.362 317.552 509.037C310.095 511.031 302.258 512.097 294.172 512.097C244.319 512.097 203.906 471.682 203.906 421.829C203.906 413.743 204.969 405.905 206.963 398.448C190.639 382.115 180.543 359.555 180.543 334.638C180.543 292.871 208.91 257.73 247.429 247.43Z"
        />
      </mask>
      <path
        d="M247.429 247.43L252.746 267.312L264.238 264.239L267.311 252.747L247.429 247.43ZM334.638 180.543L334.638 159.962L334.638 159.962L334.638 180.543ZM398.449 206.964L383.9 221.521L392.297 229.913L403.765 226.846L398.449 206.964ZM421.829 203.905L421.829 183.325L421.829 183.325L421.829 203.905ZM512.096 294.173L532.677 294.173L532.677 294.173L512.096 294.173ZM509.037 317.553L489.155 312.236L486.087 323.705L494.48 332.102L509.037 317.553ZM535.458 381.364L556.039 381.364L556.039 381.364L535.458 381.364ZM468.571 468.572L463.255 448.69L451.762 451.763L448.689 463.255L468.571 468.572ZM381.364 535.459L381.364 556.04L381.364 556.04L381.364 535.459ZM317.552 509.037L332.101 494.481L323.704 486.088L312.235 489.155L317.552 509.037ZM294.172 512.097L294.172 532.678L294.173 532.678L294.172 512.097ZM203.906 421.829L183.325 421.829L183.325 421.829L203.906 421.829ZM206.963 398.448L226.845 403.765L229.912 392.297L221.52 383.9L206.963 398.448ZM180.543 334.638L159.962 334.638L159.962 334.639L180.543 334.638ZM247.429 247.43L267.311 252.747C275.266 223.003 302.423 201.124 334.638 201.124L334.638 180.543L334.638 159.962C283.319 159.962 240.195 194.819 227.547 242.113L247.429 247.43ZM334.638 180.543L334.638 201.124C353.88 201.124 371.268 208.896 383.9 221.521L398.449 206.964L412.997 192.407C392.962 172.383 365.231 159.962 334.638 159.962L334.638 180.543ZM398.449 206.964L403.765 226.846C409.506 225.311 415.557 224.486 421.829 224.486L421.829 203.905L421.829 183.325C411.929 183.325 402.305 184.629 393.132 187.082L398.449 206.964ZM421.829 203.905L421.828 224.486C460.315 224.486 491.516 255.687 491.516 294.173L512.096 294.173L532.677 294.173C532.677 232.953 483.048 183.325 421.829 183.325L421.829 203.905ZM512.096 294.173L491.516 294.173C491.516 300.444 490.69 306.494 489.155 312.236L509.037 317.553L528.919 322.87C531.372 313.698 532.677 304.074 532.677 294.173L512.096 294.173ZM509.037 317.553L494.48 332.102C507.105 344.735 514.877 362.122 514.877 381.364L535.458 381.364L556.039 381.364C556.039 350.771 543.618 323.04 523.594 303.005L509.037 317.553ZM535.458 381.364L514.877 381.364C514.877 413.578 492.999 440.735 463.255 448.69L468.571 468.572L473.888 488.454C521.182 475.806 556.039 432.683 556.039 381.364L535.458 381.364ZM468.571 468.572L448.689 463.255C440.735 492.999 413.578 514.878 381.364 514.878L381.364 535.459L381.364 556.04C432.683 556.04 475.806 521.183 488.454 473.889L468.571 468.572ZM381.364 535.459L381.364 514.878C362.122 514.878 344.733 507.106 332.101 494.481L317.552 509.037L303.003 523.594C323.038 543.619 350.77 556.04 381.364 556.04L381.364 535.459ZM317.552 509.037L312.235 489.155C306.493 490.691 300.443 491.516 294.172 491.516L294.172 512.097L294.173 532.678C304.073 532.678 313.698 531.372 322.869 528.919L317.552 509.037ZM294.172 512.097L294.172 491.516C255.686 491.516 224.486 460.316 224.486 421.829L203.906 421.829L183.325 421.829C183.325 483.048 232.953 532.678 294.172 532.678L294.172 512.097ZM203.906 421.829L224.486 421.829C224.486 415.555 225.311 409.504 226.845 403.765L206.963 398.448L187.081 393.131C184.627 402.307 183.325 411.932 183.325 421.829L203.906 421.829ZM206.963 398.448L221.52 383.9C208.895 371.268 201.124 353.88 201.124 334.638L180.543 334.638L159.962 334.639C159.962 365.231 172.382 392.962 192.406 412.997L206.963 398.448ZM180.543 334.638L201.124 334.638C201.124 302.423 223.002 275.266 252.746 267.312L247.429 247.43L242.112 227.547C194.818 240.195 159.962 283.319 159.962 334.638L180.543 334.638Z"
        fill="currentColor"
        mask="url(#codex-home-icon-mask)"
      />
      <path
        d="M436.706 408.738H370.021"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M276.533 309.154L303.468 357.831C304.433 359.575 304.412 361.698 303.414 363.423L276.533 409.854"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />
    </svg>
  );
}

