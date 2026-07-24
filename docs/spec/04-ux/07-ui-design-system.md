# 07. UI Design System

## 1. Goals

1. Provide a **single source of truth** for visual tokens, component foundations, and layout metrics across PI-Desktop
2. Ensure **high readability and contrast** in both light and dark themes — this is a developer workstation, not a marketing surface
3. Map all design decisions to **Tailwind CSS tokens** so that spec → implementation is unambiguous
4. Enable **future shadcn-like primitive extraction** without re-specifying foundations

## 2. Non-goals

1. A consumer-brand identity system with vibrant gradients or playful illustrations
2. A full component library spec (that is [08-component-spec.md](08-component-spec.md))
3. Custom font services or CDN font hosting — use local bundling
4. Complex theme marketplace or user-customizable color palettes (MVP: system/light/dark only)
5. Pixel-perfect Figma handoff artifacts

## 3. Visual principles

| Principle | Application |
|---|---|
| **Clarity over decoration** | No ornamental borders, gradients, or hero images. Every visual element carries information. |
| **Developer density** | Compact spacing, small-but-readable type, minimal marketing whitespace. Information-rich, not sparse. |
| **Dark-base defaults** | Dark theme is the primary theme for a coding agent. Light must be fully supported but is secondary. |
| **Restraint** | One accent color family. No rainbow status colors — use semantic token names (success, warning, error). |
| **Motion as feedback** | Animations convey state change (streaming, loading, expand/collapse). Never decorative. |
| **Keyboard-first** | Focus rings, tab order, and shortcut labels are primary UX, not afterthoughts. |

## 4. Color tokens

### 4.1 Semantic token naming

All color references in components use **semantic token names**, never raw hex values.

```text
--color-bg-primary        → main background (chat area, panels)
--color-bg-secondary      → sidebar, cards, nested surfaces
--color-bg-tertiary       → hover states, elevated surfaces
--color-bg-inset          → code blocks, inset areas
--color-text-primary      → main body text
--color-text-secondary    → secondary/label text
--color-text-muted        → disabled, placeholder, hint
--color-border-default    → default borders
--color-border-subtle     → subtle separators (divider lines)
--color-accent            → primary accent (CTA, active states)
--color-accent-hover      → accent hover
--color-success           → success/run states
--color-warning           → warning/caution states
--color-error             → error/denied states
--color-info              → informational states
```

### 4.2 Dark theme (primary)

| Token | Hex | Tailwind mapping | Usage |
|---|---|---|---|
| `--color-bg-primary` | `#0F172A` | `bg-slate-950` | Main background |
| `--color-bg-secondary` | `#1E293B` | `bg-slate-800` | Sidebar, card surfaces |
| `--color-bg-tertiary` | `#334155` | `bg-slate-700` | Hover, elevated |
| `--color-bg-inset` | `#020617` | `bg-slate-950` (deeper) | Code blocks, inset |
| `--color-text-primary` | `#F8FAFC` | `text-slate-50` | Body text |
| `--color-text-secondary` | `#CBD5E1` | `text-slate-300` | Labels, secondary |
| `--color-text-muted` | `#64748B` | `text-slate-500` | Disabled, hints |
| `--color-border-default` | `#334155` | `border-slate-700` | Default borders |
| `--color-border-subtle` | `#1E293B` | `border-slate-800` | Subtle separators |
| `--color-accent` | `#3B82F6` | `text-blue-500` | Primary accent, CTA |
| `--color-accent-hover` | `#60A5FA` | `text-blue-400` | Accent hover |
| `--color-success` | `#22C55E` | `text-green-500` | Success, run complete |
| `--color-warning` | `#F59E0B` | `text-amber-500` | Warning, caution |
| `--color-error` | `#EF4444` | `text-red-500` | Error, denied |
| `--color-info` | `#6366F1` | `text-indigo-500` | Informational |

### 4.3 Light theme

| Token | Hex | Tailwind mapping | Usage |
|---|---|---|---|
| `--color-bg-primary` | `#FFFFFF` | `bg-white` | Main background |
| `--color-bg-secondary` | `#F8FAFC` | `bg-slate-50` | Sidebar, card surfaces |
| `--color-bg-tertiary` | `#F1F5F9` | `bg-slate-100` | Hover, elevated |
| `--color-bg-inset` | `#F1F5F9` | `bg-slate-100` | Code blocks, inset |
| `--color-text-primary` | `#0F172A` | `text-slate-900` | Body text |
| `--color-text-secondary` | `#475569` | `text-slate-600` | Labels, secondary |
| `--color-text-muted` | `#94A3B8` | `text-slate-400` | Disabled, hints |
| `--color-border-default` | `#E2E8F0` | `border-slate-200` | Default borders |
| `--color-border-subtle` | `#F1F5F9` | `border-slate-100` | Subtle separators |
| `--color-accent` | `#2563EB` | `text-blue-600` | Primary accent, CTA |
| `--color-accent-hover` | `#1D4ED8` | `text-blue-700` | Accent hover |
| `--color-success` | `#16A34A` | `text-green-600` | Success, run complete |
| `--color-warning` | `#D97706` | `text-amber-600` | Warning, caution |
| `--color-error` | `#DC2626` | `text-red-600` | Error, denied |
| `--color-info` | `#4F46E5` | `text-indigo-600` | Informational |

### 4.4 System theme behavior

- `system` theme follows `prefers-color-scheme` media query
- Transition between themes must not flash white when switching to dark on launch
- Initial load: detect system preference before first paint (Electron preload can relay this)

### 4.5 Tailwind CSS variable stub

The following CSS custom properties stub is the canonical bridge between spec tokens and Tailwind classes. It is **not an app source file** — it documents the intended mapping for implementation.

```css
/* === Design System Token Bridge (spec reference, not runtime file) === */
/* Dark theme (default) */
:root[data-theme="dark"] {
  --color-bg-primary:       #0F172A;
  --color-bg-secondary:     #1E293B;
  --color-bg-tertiary:      #334155;
  --color-bg-inset:         #020617;
  --color-text-primary:     #F8FAFC;
  --color-text-secondary:   #CBD5E1;
  --color-text-muted:       #64748B;
  --color-border-default:   #334155;
  --color-border-subtle:    #1E293B;
  --color-accent:           #3B82F6;
  --color-accent-hover:     #60A5FA;
  --color-success:          #22C55E;
  --color-warning:          #F59E0B;
  --color-error:            #EF4444;
  --color-info:             #6366F1;
}

/* Light theme */
:root[data-theme="light"] {
  --color-bg-primary:       #FFFFFF;
  --color-bg-secondary:     #F8FAFC;
  --color-bg-tertiary:      #F1F5F9;
  --color-bg-inset:         #F1F5F9;
  --color-text-primary:     #0F172A;
  --color-text-secondary:   #475569;
  --color-text-muted:       #94A3B8;
  --color-border-default:   #E2E8F0;
  --color-border-subtle:    #F1F5F9;
  --color-accent:           #2563EB;
  --color-accent-hover:     #1D4ED8;
  --color-success:          #16A34A;
  --color-warning:          #D97706;
  --color-error:            #DC2626;
  --color-info:             #4F46E5;
}

/* Tailwind v4 theme extension (in tailwind config) */
/* Maps semantic tokens to utility classes */
/*
@theme {
  --color-bg-primary:    var(--color-bg-primary);
  --color-bg-secondary:  var(--color-bg-secondary);
  --color-bg-tertiary:   var(--color-bg-tertiary);
  --color-bg-inset:      var(--color-bg-inset);
  --color-text-primary:  var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted:    var(--color-text-muted);
  --color-border-default: var(--color-border-default);
  --color-border-subtle:  var(--color-border-subtle);
  --color-accent:        var(--color-accent);
  --color-accent-hover:  var(--color-accent-hover);
  --color-success:       var(--color-success);
  --color-warning:       var(--color-warning);
  --color-error:         var(--color-error);
  --color-info:          var(--color-info);
}
*/
```

Implementation note: Tailwind v4 supports CSS-first configuration. The `@theme` directive maps custom properties to utility classes (`bg-bg-primary`, `text-text-primary`, etc.). Implementation should validate naming to avoid double-prefix collision (e.g., `bg-bg` is awkward — consider aliasing to `bg-primary`, `text-primary` etc. at the Tailwind level).

## 5. Typography

### 5.1 Font stacks

| Role | Primary | Fallback stack | Tailwind |
|---|---|---|---|
| **UI (sans)** | Inter | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | `font-sans` |
| **Code (mono)** | JetBrains Mono | `"Fira Code", ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace` | `font-mono` |

### 5.2 Type scale

| Token | Size (px/rem) | Weight | Line-height | Usage |
|---|---|---|---|---|
| `text-xs` | 12px / 0.75rem | 400 | 1.5 | Timestamps, badges, hints |
| `text-sm` | 13px / 0.8125rem | 400 | 1.5 | Secondary text, labels, sidebar items |
| `text-base` | 14px / 0.875rem | 400 | 1.6 | Body text, chat messages, input |
| `text-lg` | 16px / 1rem | 500 | 1.5 | Section headers, card titles |
| `text-xl` | 18px / 1.125rem | 600 | 1.4 | Page titles, topbar heading |
| `text-2xl` | 20px / 1.25rem | 700 | 1.3 | Hero empty states (rare) |

> Note: 14px base is intentional for developer-density. Do not bump to 16px default.

### 5.3 Code text sizing

- Code blocks and tool output: `text-sm` (13px) with `font-mono`
- Inline code within messages: `text-sm` `font-mono`, background `bg-inset`, px-1 py-0.5 rounded

### 5.4 Weight rules

- 400: all default body/label text
- 500: section headers, emphasis
- 600: page titles, CTA buttons
- 700: hero/empty-state headings (rare)
- Never use 800–900

## 6. Spacing, radius, elevation, borders

### 6.1 Spacing scale

| Token | Value | Usage |
|---|---|---|
| `space-0.5` | 2px | Tight inline gaps |
| `space-1` | 4px | Icon-text gaps, badge padding |
| `space-1.5` | 6px | Compact inner padding |
| `space-2` | 8px | Standard inner padding, list gaps |
| `space-3` | 12px | Card inner padding, section gaps |
| `space-4` | 16px | Section margins, composer padding |
| `space-6` | 24px | Panel gaps, major separations |
| `space-8` | 32px | Page-level margins (rare) |

### 6.2 Radius scale

| Token | Value | Usage |
|---|---|---|
| `radius-none` | 0 | Full-bleed panels, code blocks |
| `radius-sm` | 4px | Buttons, inputs, inline badges |
| `radius-md` | 6px | Cards, tool call cards |
| `radius-lg` | 8px | Dialogs, modals |
| `radius-xl` | 12px | Large panels (rare) |

### 6.3 Elevation / shadows

Dark theme: elevation is expressed via **background surface layering** (bg-secondary → bg-tertiary), not box-shadow.

Light theme: minimal shadows only where layering is insufficient.

| Level | Dark | Light | Usage |
|---|---|---|---|
| `elevation-0` | flat (bg-primary) | flat (bg-primary) | Default surface |
| `elevation-1` | bg-secondary | bg-secondary + `shadow-sm` | Cards, sidebar |
| `elevation-2` | bg-tertiary | bg-tertiary + `shadow-md` | Hover, dropdowns |
| `elevation-3` | bg-tertiary + border-accent | bg-white + `shadow-lg` | Dialogs, overlays |

Shadow token values (light theme only):

```text
shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
shadow-md:  0 2px 8px rgba(0,0,0,0.08)
shadow-lg:  0 8px 24px rgba(0,0,0,0.12)
```

### 6.4 Border rules

| Context | Token | Width | Style |
|---|---|---|---|
| Default separators | `border-subtle` | 1px | solid |
| Card outlines | `border-default` | 1px | solid |
| Focus rings | accent color | 2px | solid, offset 2px |
| Active/pressed | accent color | 1px inset | solid |

## 7. Iconography

### 7.1 Icon set

- **Primary:** Lucide (SVG, MIT license, 24×24 default grid)
- **Alternative:** Heroicons v2 (outline variant)
- Never mix both in the same surface — pick one per implementation file
- **Never use emoji as icons** — emoji are text content, not UI affordances

### 7.2 Sizing

| Context | Size | Stroke width |
|---|---|---|
| Inline with text | 16px (1rem) | 1.5px |
| Buttons, toolbar | 20px (1.25rem) | 2px |
| Empty states | 48px (3rem) | 1.5px |

### 7.3 Color rules

- Default: `text-secondary`
- Hover/active: `text-primary`
- Accent actions: `accent` color
- Disabled: `text-muted`
- Never use colored icon backgrounds in buttons (no icon circles/squares)

## 8. Motion

### 8.1 Duration scale

| Token | Duration | Usage |
|---|---|---|
| `duration-fast` | 150ms | Hover transitions, color changes |
| `duration-normal` | 200ms | Expand/collapse, slide-in |
| `duration-slow` | 300ms | Panel transitions, dialog enter |

### 8.2 Easing

- Default: `ease-out` (Tailwind default)
- Enter animations: `ease-out`
- Exit animations: `ease-in`
- Spring-like for drag/releases: **not in MVP** (use `ease-out`)

### 8.3 Reduced motion

All motion tokens must respect `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

> See also [09-interaction-patterns.md](09-interaction-patterns.md) §10.

### 8.4 Prohibited motion

- No parallax
- No continuous background animations (particles, waves)
- No shimmer/skeleton animations longer than 1s loop — use simple fade-in for loading states
- No bounce effects

## 9. Z-index layers

| Layer | Z-index | Usage |
|---|---|---|
| `z-base` | 0 | Default content |
| `z-sticky` | 10 | Sticky headers, topbar |
| `z-dropdown` | 20 | Dropdown menus, select popovers |
| `z-overlay` | 30 | Tooltips |
| `z-dialog` | 40 | Dialogs, permission modal |
| `z-toast` | 50 | Toast notifications |
| `z-command-palette` | 60 | Command palette overlay |
| `z-devtools` | 100 | DevTools overlay (non-production) |

Rules:

- Never use `z-index: 9999` or similar arbitrary high values
- Each layer is a fixed offset; no custom z-index outside these layers
- Stacking within a layer uses DOM order, not higher z-values

## 10. Layout shell metrics

These metrics define the AppShell frame. See [08-component-spec.md](08-component-spec.md) for component detail.

| Metric | Value | Notes |
|---|---|---|
| Topbar height | 44px | Compact; contains project, model, mode, abort, settings |
| Sidebar width (collapsed) | 48px | Icon-only rail |
| Sidebar width (expanded) | 240px | Session list + labels |
| Context panel width (collapsed) | 0px | Hidden by default |
| Context panel width (expanded) | 280px | Project/status panel |
| Composer min height | 80px | Single-line + padding |
| Composer max height | 320px | ~10 lines before scroll |
| Chat message max width | 720px | Prevent eye-span over-stretch |
| Window min width | 800px | Below this, hide context panel |
| Window min height | 600px | Below this, compress sidebar |

### 10.1 Responsive collapse

- Width < 800px: context panel auto-collapses
- Width < 640px: sidebar auto-collapses to icon rail
- Width < 480px: not supported — enforce minimum window size in Electron

## 11. Component foundations

These are **token-level foundations** for common primitives. Detailed component specs are in [08-component-spec.md](08-component-spec.md).

### 11.1 Button

| Variant | Padding | Height | Font | Radius | Border | Background |
|---|---|---|---|---|---|---|
| Primary | px-3 py-1.5 | 32px | text-sm 500 | radius-sm | none | accent |
| Secondary | px-3 py-1.5 | 32px | text-sm 400 | radius-sm | border-default | bg-secondary |
| Ghost | px-2 py-1 | 28px | text-sm 400 | radius-sm | none | transparent |
| Danger | px-3 py-1.5 | 32px | text-sm 500 | radius-sm | none | error |

### 11.2 Input / textarea

| Property | Value |
|---|---|
| Height (single-line) | 32px |
| Padding | px-3 py-1.5 |
| Font | text-sm font-mono (for composer); text-sm font-sans (for settings) |
| Border | 1px border-default; focus → 2px accent ring offset-2 |
| Background | bg-primary |
| Radius | radius-sm |

### 11.3 Card

| Property | Value |
|---|---|
| Padding | p-3 |
| Border | 1px border-default |
| Radius | radius-md |
| Background | bg-secondary |
| Hover (interactive) | bg-tertiary, no shadow change |

### 11.4 Dialog / modal

| Property | Value |
|---|---|
| Max width | 480px |
| Padding | p-6 |
| Radius | radius-lg |
| Background | bg-secondary (dark); bg-white (light) + shadow-lg |
| Backdrop | rgba(0,0,0,0.5) with `z-dialog` |
| Close | Escape key + X button top-right |

### 11.5 Tabs

| Variant | Indicator |
|---|---|
| Underline tabs | 2px accent line below active tab |
| Padding | px-3 py-2 text-sm |
| Active | text-primary + accent underline |
| Inactive | text-secondary, hover → text-primary |

### 11.6 Badge

| Variant | Size | Font | Radius | Padding |
|---|---|---|---|---|
| Default | auto | text-xs 500 | radius-sm | px-1.5 py-0.5 |
| Status dot | 8px circle | — | radius-full | — |

Status badge colors: success (green), warning (amber), error (red), info (indigo), muted (slate).

### 11.7 Tooltip

| Property | Value |
|---|---|
| Font | text-xs |
| Padding | px-2 py-1 |
| Radius | radius-sm |
| Background | bg-tertiary (dark); bg-slate-800 (light) |
| Text | text-primary |
| Delay | 300ms show, 100ms hide |
| Max width | 240px |

### 11.8 Toast

| Property | Value |
|---|---|
| Position | bottom-right, offset 16px from edges |
| Max width | 360px |
| Font | text-sm |
| Padding | px-4 py-3 |
| Radius | radius-md |
| Duration | 4s auto-dismiss (error: 8s, no auto-dismiss) |
| Stack | vertical, newest on top |
| Z-index | z-toast |

## 12. State patterns

### 12.1 Interactive states

| State | Background | Text | Border | Cursor | Motion |
|---|---|---|---|---|---|
| Default | per variant | per variant | per variant | default | — |
| Hover | bg-tertiary or accent-hover | text-primary | — | pointer | 150ms |
| Focus | — | — | 2px accent ring offset-2 | default | — |
| Focus-visible | same as focus (only on keyboard focus) | — | 2px accent ring offset-2 | default | — |
| Active/pressed | accent bg, text inverted | text-primary (inverted) | — | pointer | — |
| Disabled | bg-secondary | text-muted | border-subtle | not-allowed | — |
| Loading | same as default + spinner | text-secondary | — | wait | spinner 1s rotate |

### 12.2 Semantic states

| Semantic | Indicator | Color |
|---|---|---|
| Success | icon ✓ or green dot | success token |
| Error | icon ✗ or red dot + inline message | error token |
| Warning | icon ⚠ or amber dot | warning token |
| Running | spinner (blue) + pulsing border-left | accent token |
| Pending | dimmed + clock icon | muted token |
| Denied | red outline + "Denied" label | error token |

### 12.3 Streaming indicator

- Running agent: accent-colored spinner in topbar + subtle pulse on left border of latest assistant message
- Completed: spinner replaced by success icon for 2s, then fades
- Error: spinner replaced by error icon, persistent until dismissed

## 13. Content density rules

| Rule | Application |
|---|---|
| **Base padding 8px (space-2)** | Default inner padding for list items, form groups |
| **Message gap 12px (space-3)** | Between chat messages — tight but scannable |
| **Section gap 16px (space-4)** | Between distinct UI sections (sidebar sections, settings groups) |
| **Panel gap 0px** | Panels touch edge-to-edge with border-subtle separator — no gutters |
| **Compact list rows 28px height** | Sidebar session items, settings list rows |
| **Button rows 32px height** | Standard buttons |
| **Never exceed 24px vertical gap** | Even for "breathing room" — this is a workstation |
| **Max content width 720px** | Chat messages, tool cards — prevent over-wide eye-span |

## 14. Do / Don't

### Do

- Use semantic tokens (`text-primary`, `bg-secondary`) — never raw hex in component code
- Use `font-mono` for all code, file paths, tool arguments, terminal output
- Provide visible focus rings on every interactive element
- Test contrast ratios: **4.5:1 minimum** for normal text, 3:1 for large text
- Keep motion under 300ms and respect `prefers-reduced-motion`
- Collapse long content by default (tool results, long messages) — see [09-interaction-patterns.md](09-interaction-patterns.md) §4
- Use Lucide/Heroicons SVG icons — never emoji as UI affordances
- Use compact padding and tight spacing — developer density, not consumer spacing
- Default to dark theme for first launch experience

### Don't

- Don't hardcode `#0F172A` or any hex value in component JSX — use tokens
- Don't use emoji as icon substitutes (🚀, ✅, ❌ are text, not UI icons)
- Don't add decorative gradients, glass-morphism, or neon effects
- Don't use `z-index` values outside the defined layers
- Don't animate for decoration — motion is feedback only
- Don't set `font-size: 16px` as base — 14px is the workstation default
- Don't use large hero images or marketing-style empty states
- Don't apply rounded corners to full-width panels (sidebar, topbar)
- Don't use `border-radius: 0` on buttons and inputs (use `radius-sm` minimum)
- Don't show raw API keys in any UI surface

## 15. Acceptance criteria

1. All color tokens defined as CSS custom properties with Tailwind `@theme` mapping
2. Dark and light themes render correctly with ≥4.5:1 contrast on all text/background pairs
3. `system` theme follows `prefers-color-scheme` without white-flash on dark startup
4. Typography uses Inter (sans) and JetBrains Mono (mono) with defined fallback stacks
5. Base font size is 14px; no component defaults to 16px body text
6. All interactive elements have visible `focus-visible` rings using accent color
7. All motion respects `prefers-reduced-motion: reduce`
8. No raw hex color values in React component source (only token references)
9. Z-index usage confined to defined layers (no arbitrary values)
10. Layout shell metrics (topbar, sidebar, composer) match spec values in CSS
11. Icon components use Lucide/Heroicons SVG — no emoji icon affordances
12. Spacing values use the defined scale (no arbitrary pixel values in component code)
