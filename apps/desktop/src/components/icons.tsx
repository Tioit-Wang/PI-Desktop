import type { SVGProps } from "react";
import {
  AppWindow,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  AtSign,
  Bug,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  CloudDownload,
  CodeXml,
  Copy,
  Dot,
  ExternalLink,
  FileText,
  Folder,
  Globe2,
  GitPullRequestArrow,
  Hammer,
  Image,
  Info,
  Keyboard,
  Link,
  Mic,
  Palette,
  PanelLeft,
  PanelRight,
  PawPrint,
  PenLine,
  PencilLine,
  Pin,
  Plug,
  Plus,
  RefreshCcw,
  RefreshCw,
  RotateCw,
  Search,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Square,
  Star,
  Sun,
  Terminal,
  TriangleAlert,
  UserRound,
  Webhook,
  Wrench,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

type IconProps = LucideProps;

/* Defaults (16px, 1.75 stroke) match the app's previous hand-drawn icon set. */
function icon(Lucide: LucideIcon) {
  return function Icon(props: IconProps) {
    return <Lucide size={16} strokeWidth={1.75} {...props} />;
  };
}

export const IconPlus = icon(Plus);
export const IconSearch = icon(Search);
export const IconCompose = icon(PenLine);
export const IconFolder = icon(Folder);
export const IconFileText = icon(FileText);
export const IconGlobe = icon(Globe2);
export const IconTerminal = icon(Terminal);
export const IconPencil = icon(PencilLine);
export const IconWrench = icon(Wrench);
export const IconPullRequest = icon(GitPullRequestArrow);
export const IconClock = icon(Clock);
export const IconAt = icon(AtSign);
export const IconSettings = icon(Settings);
export const IconHelp = icon(CircleHelp);
export const IconPanel = icon(PanelRight);
export const IconSidebar = icon(PanelLeft);
export const IconArrowUp = icon(ArrowUp);
export const IconArrowDown = icon(ArrowDown);
export const IconCopy = icon(Copy);
export const IconCheck = icon(Check);
export const IconShield = icon(Shield);
export const IconChevronDown = icon(ChevronDown);
export const IconClose = icon(X);
export const IconSliders = icon(SlidersHorizontal);
export const IconConfig = icon(RefreshCcw);
export const IconChevronLeft = icon(ChevronLeft);
export const IconChevronRight = icon(ChevronRight);
export const IconExternal = icon(ExternalLink);
export const IconArrowUpRight = icon(ArrowUpRight);
export const IconCloudDown = icon(CloudDownload);
export const IconImage = icon(Image);
export const IconCamera = icon(Camera);
export const IconExplore = icon(CodeXml);
export const IconBuild = icon(Hammer);
export const IconReview = icon(RefreshCw);
export const IconFix = icon(Bug);
export const IconKeyboard = icon(Keyboard);
export const IconMic = icon(Mic);
export const IconPlug = icon(Plug);
export const IconUser = icon(UserRound);
export const IconSparkles = icon(Sparkles);
export const IconBrowser = icon(AppWindow);
export const IconHook = icon(Webhook);
export const IconLink = icon(Link);
export const IconPalette = icon(Palette);
export const IconPerson = icon(Smile);
export const IconInfo = icon(Info);
export const IconServer = icon(Server);
export const IconSun = icon(Sun);
export const IconPet = icon(PawPrint);
export const IconSnapshot = icon(RotateCw);
export const IconGear = icon(Settings);
export const IconPin = icon(Pin);
export const IconStar = icon(Star);
/* Toast status glyphs (see ToastHost) */
export const IconCircleCheck = icon(CircleCheck);
export const IconCircleAlert = icon(CircleAlert);
export const IconTriangleAlert = icon(TriangleAlert);

export function IconStop(props: IconProps) {
  return <Square size={16} strokeWidth={0} fill="currentColor" {...props} />;
}

/* Heavy round-capped stroke renders Lucide's Dot at the old filled-dot size. */
export function IconDot(props: IconProps) {
  return <Dot size={16} strokeWidth={6.5} {...props} />;
}

/** VS Code brand mark (settings open-target pill) — logos stay custom, no Lucide equivalent. */
export function IconVSCode(props: SVGProps<SVGSVGElement> & { size?: number }) {
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

/** App home mark — brand glyph, stays custom. */
export function IconCodexHome(props: SVGProps<SVGSVGElement> & { size?: number }) {
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
