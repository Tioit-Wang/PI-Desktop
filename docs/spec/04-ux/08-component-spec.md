# 08. Component Spec

> Layout and IA reference: [01-ui-ia.md](01-ui-ia.md)  
> Design tokens and foundations: [07-ui-design-system.md](07-ui-design-system.md)  
> Interaction behavior: [09-interaction-patterns.md](09-interaction-patterns.md)


> Shell layout is Codex-aligned: left thread sidebar (~275px), main transcript, floating bottom composer with project/model chips. Prefer neutral charcoal surfaces over blue-slate chrome.
>
> **Precedence rule**: where a metric or copy string below disagrees with a
> Codex parity decision in [decisions-log §D](../08-meta/decisions-log.md)
> (D034+), the decision log wins — it tracks the live gold captures. Known
> updated values: sidebar ~275px (not 240px), toolbar 46px (not 44px),
> composer placeholder per D046/D066, home split-grow per D045/D047,
> Projects index table per D066, settings full-page shell per D062/D063,
> session pinning shipped per D068.

## 1. AppShell

### 1.1 Purpose

Outer frame that positions Topbar, Sidebar, MainChat, and ContextPanel. Owns resize logic, responsive collapse, and theme class.

### 1.2 Anatomy

```text
+------------------+------------------------------+------------------+
| Sidebar          | MainChat                     | ContextPanel     |
| (275px / 48px)   | (flex-1)                     | (280px / hidden) |
+------------------+------------------------------+------------------+
| Titlebar row: 46px, traffic lights at {x:16,y:16} (D034/D070)      |
+--------------------------------------------------------------------+
```

### 1.3 States

| State | Behavior |
|---|---|
| Default | Sidebar expanded, context hidden |
| Narrow (<800px) | Context auto-collapses |
| Narrow (<640px) | Sidebar auto-collapses to icon rail |
| Fullscreen | Topbar remains; sidebar/context toggle |

### 1.4 Interactions

- Sidebar toggle: keyboard shortcut + hamburger button in topbar
- Context panel toggle: keyboard shortcut + panel button in topbar
- Window resize: responsive collapse per [07-ui-design-system.md](07-ui-design-system.md) §10.1

### 1.5 Accessibility

- Landmark roles: `<nav>` for sidebar, `<main>` for chat, `<aside>` for context panel, `<header>` for topbar
- Tab sequence: topbar → sidebar → main chat → context panel → composer

### 1.6 MVP constraints

- No drag-to-resize panel widths (fixed values)
- No multi-tab sessions (single active session)
- No status bar (deferred)

---

## 2. Topbar

### 2.1 Purpose

Global controls bar: project identity, model selection, mode indicator, abort button, settings entry.

### 2.2 Anatomy

```text
[☰ Sidebar] [📁 Project name] [🤖 Model: provider/model] [🛡 Mode badge] [⏹ Abort] [⚙ Settings]
```

(Icons described functionally; actual render uses Lucide SVGs.)

### 2.3 Layout

- Height: 46px (Codex toolbar rhythm, D034; supersedes the old 44px)
- Background: bg-secondary
- Border: border-subtle bottom
- Sticky: `z-sticky`
- Items: left-aligned controls, right-aligned actions

### 2.4 States

| Element | Default | Running | Error | No workspace |
|---|---|---|---|---|
| Model selector | clickable dropdown | disabled during stream | clickable | clickable (no provider warning) |
| Mode badge | "Agent" or "Chat" badge | same | same | same |
| Abort button | hidden | visible, accent-hover pulse | hidden | hidden |
| Project name | workspace folder name | same | same | "No project" muted |

### 2.5 Accessibility

- Every control is keyboard-reachable with Tab
- Abort button has `aria-label="Abort active turn"`
- Model selector announces current value via `aria-label`

### 2.6 MVP constraints

- No search field in topbar (deferred)
- No notification indicator (deferred)

---

## 3. Sidebar

### 3.1 Purpose

Session navigation and management. Toggle between expanded (session list) and collapsed (icon rail).

### 3.2 Anatomy

```text
Expanded (~275px, D034/D070):
+---------------------------+
| [+ New Chat] button       |
| [🔍 Search] (deferred)    |
| ─────────────────         |
| Session list (scrollable)  |
|   • Session title (date)  |
|   • Active highlight      |
| ─────────────────         |
| [⚙ Settings] bottom link  |
+---------------------------+

Collapsed (48px):
+----+
| [+] |
| ──  |
| ses |
| ses |
| ──  |
| [⚙] |
+----+
```

### 3.3 States

| State | Behavior |
|---|---|
| Expanded | Full session titles visible |
| Collapsed | Icon rail — hover shows tooltip with session title |
| Active session | Accent background highlight on current session item |
| Hover session | bg-tertiary background |

### 3.4 Interactions

- Click session: switch active session, scroll to last message
- Click "+ New Chat": create session, focus composer
- Right-click session: context menu (rename, delete) — MVP: via command palette only
- Sidebar toggle: Topbar hamburger + keyboard shortcut

### 3.5 Accessibility

- Session list: `role="list"` with `role="listitem"` per session
- Active session: `aria-current="true"`
- Collapsed state: each icon has `aria-label` with session title
- Keyboard: arrow keys navigate session list

### 3.6 MVP constraints

- No sidebar search (deferred per [01-ui-ia.md](01-ui-ia.md))
- No drag-to-reorder sessions
- No session grouping/folders

---

## 4. MainChat

### 4.1 Purpose

Primary chat area containing ChatTranscript and Composer. Scrollable, center of the workstation.

### 4.2 Anatomy

```text
+--------------------------------------+
| ChatTranscript (scrollable, flex-1)  |
|   MessageBubble (user/assistant)     |
|   ToolCallCard                       |
|   PermissionCard                     |
|   ...                                |
+--------------------------------------+
| Composer (docked in thread view;     |
| home uses split-grow, D045/D047)     |
+--------------------------------------+
```

### 4.3 Layout

- Background: bg-primary
- Max content width: 720px (messages), centered
- Scroll behavior: auto-scroll to bottom on new message; manual scroll pauses auto-scroll

### 4.4 States

| State | Behavior |
|---|---|
| Empty | Onboarding checklist or empty-state prompt |
| Streaming | Auto-scroll locked; new tokens append |
| Idle (after stream) | Auto-scroll unlocked; user can scroll freely |

### 4.5 Accessibility

- `role="log"` for transcript container
- `aria-live="polite"` on transcript for new message announcements
- Scroll-to-bottom button appears when user scrolls up during stream

### 4.6 MVP constraints

- No split-pane chat (single thread)
- No markdown editor preview split

---

## 5. ContextPanel

### 5.1 Purpose

Secondary panel for project metadata, workspace status, and session details. Collapsed by default in MVP.

### 5.2 Anatomy

```text
+--------------------+
| Project name       |
| Workspace path     |
| ──────────────     |
| Session grants     |
|   toolName ×      |
|   grantedAt        |
| ──────────────     |
| Status indicators  |
+--------------------+
```

### 5.3 States

| State | Behavior |
|---|---|
| No project | "Open a project" prompt with action link |
| Active project | Project name, path, workspace stats |
| Has grants | Grant list with clear buttons per [03-permission-ux.md](03-permission-ux.md) §8 |

### 5.4 Accessibility

- `role="complementary"` landmark
- Close button with `aria-label="Close context panel"`

### 5.5 MVP constraints

- No file tree view (deferred per [01-ui-ia.md](01-ui-ia.md) §11)
- No diff editor view
- No terminal matrix

---

## 6. SessionList

### 6.1 Purpose

List of user sessions inside the sidebar. Allows switching, creating, and deleting sessions.

### 6.2 Anatomy

Each session item:

```text
[icon] Session title
       Last activity timestamp · Mode badge
```

### 6.3 States

| State | Appearance |
|---|---|
| Active | accent bg highlight, text-primary |
| Inactive | bg-secondary, text-secondary |
| Hover (inactive) | bg-tertiary |
| Running | accent pulse on left border |
| Error | error dot indicator |

### 6.4 Interactions

- Click: activate session
- Keyboard: arrow up/down, Enter to select
- Delete: via command palette `builtin.session.delete`

### 6.5 Accessibility

- `role="listbox"` with `role="option"` per item
- `aria-selected` on active item

### 6.6 MVP constraints

- No session search/filter
- No session grouping; pinning shipped (D068: pin/panel row actions)
- Max 50 sessions shown; older sessions accessible via scroll

---

## 7. ChatTranscript

### 7.1 Purpose

Scrollable container rendering the ordered sequence of user messages, assistant responses, tool call cards, and permission cards for a session.

### 7.2 Anatomy

```text
+------------------------------------------+
| [User MessageBubble]                     |
| [Assistant MessageBubble (streaming)]    |
|   [ToolCallCard] (inline in assistant)   |
|   [ToolCallCard]                         |
|   [PermissionCard] (interrupt)           |
|   [Assistant MessageBubble (resume)]     |
| [User MessageBubble]                     |
| ...                                      |
+------------------------------------------+
```

### 7.3 States

| State | Behavior |
|---|---|
| Streaming | New tokens append; auto-scroll to bottom |
| Idle | Scrollable; no auto-scroll |
| Permission pending | PermissionCard inserted inline; transcript continues after resolution |
| Error | Error MessageBubble with actionable retry link |

### 7.4 Interactions

- Scroll: user scroll pauses auto-scroll; "scroll to bottom" floating button appears
- Click message: no action in MVP (future: copy message)
- Hover code block: copy button appears (future, not MVP)

### 7.5 Accessibility

- `role="log"` container
- `aria-live="polite"` for new content announcements
- Each message: `role="article"` with `aria-label` describing sender

### 7.6 MVP constraints

- No message search within transcript
- No message copy action
- No message branching/rewind

---

## 8. MessageBubble

### 8.1 Purpose

Single message render — either user (plaintext) or assistant (markdown streaming).

### 8.2 Anatomy

**User message:**

```text
+------------------------------------------+
| plaintext message content                |
|                    timestamp · edit icon  |
+------------------------------------------+
```

**Assistant message:**

```text
+------------------------------------------+
| [markdown rendered content]              |
|   code blocks: mono, bg-inset           |
|   inline code: mono, bg-inset           |
|                    timestamp             |
+------------------------------------------+
```

### 8.3 Layout

- Max width: 720px
- User: bg-secondary background, left-aligned
- Assistant: bg-primary (transparent), left-aligned, markdown rendered
- Gap: space-3 between consecutive messages
- Font: text-base (14px) for body; text-sm (13px) mono for code

### 8.4 States

| State | Appearance |
|---|---|
| Streaming | pulsing left border accent; content grows |
| Complete | no pulse; full rendered markdown |
| Error | error border; error message inline with retry prompt |

### 8.5 Accessibility

- User: `aria-label="User message"`
- Assistant: `aria-label="Assistant message"`
- Timestamps: `aria-label` with full time string, visual shows relative time

### 8.6 MVP constraints

- No message reactions/annotations
- No edit user message (deferred)
- No "copy message" button (deferred)

---

## 9. ToolCallCard

### 9.1 Purpose

Inline card showing a tool invocation with name, status, args preview, result preview, and duration. Defined in [01-ui-ia.md](01-ui-ia.md) §5.

### 9.2 Anatomy

```text
+----------------------------------------------+
| 🔧 toolName                    [status]      |
| ───────────────────────────                  |
| Args: { file: "/src/foo.ts", ... }           |
| ───────────────────────────                  |
| [Result preview / truncated]                 |
| Duration: 1.2s                               |
+----------------------------------------------+
```

(Icon uses Lucide `Wrench` or appropriate tool-type icon, not emoji.)

### 9.3 Layout

- Background: bg-secondary
- Border: border-default, radius-md
- Left accent border: 2px — success (green), running (accent), error (red), denied (red)
- Font: args/result in font-mono text-sm
- Max width: 720px (same as messages)

### 9.4 States

| State | Left border | Status label | Content |
|---|---|---|---|
| Running | accent pulse | "Running" | args preview shown |
| Success | success (green) | "Completed" | result preview, truncated per D033 |
| Error | error (red) | "Error" | error message preview |
| Denied | error (red) | "Denied" | "Permission denied" message |
| Timeout | warning (amber) | "Timeout" | "Timed out" message |

### 9.5 Interactions

- Click card header: expand/collapse full args/result (default collapsed for long content)
- Truncated result: "Show more" link expands to full content (capped at 256KB/4000 lines per D033)
- Copy button on result: deferred (not MVP)

### 9.6 Accessibility

- `role="region"` with `aria-label="Tool call: {toolName}"`
- Status announced via `aria-label` on status badge
- Expand/collapse: `aria-expanded` toggle

### 9.7 MVP constraints

- No inline diff rendering for Edit/Write results
- No file path click-to-open (deferred)
- No "copy result" button (deferred)

---

## 10. PermissionCard / PermissionDialog

### 10.1 Purpose

Inline card or modal dialog requesting user approval for a high-risk tool call. See [03-permission-ux.md](03-permission-ux.md) for full policy.

### 10.2 Anatomy (inline card)

```text
+----------------------------------------------+
| ⚠ Permission Required                        |
| Tool: Write · Risk: high                     |
| Reason: Agent wants to modify a file         |
| ───────────────────────────                  |
| Args preview (redacted)                      |
| Workspace: /Users/dev/project                |
| ───────────────────────────                  |
| [Allow once] [Allow for session] [Deny]      |
| Timeout: 120s countdown                       |
+----------------------------------------------+
```

### 10.3 Anatomy (dialog overlay)

Same content but rendered as a centered dialog at `z-dialog` when inline card would be insufficient (e.g., overlapping permission requests). MVP default: **inline card** within transcript.

### 10.4 States

| State | Appearance | Actions |
|---|---|---|
| Pending | warning accent, countdown visible | Allow once / Allow session / Deny buttons active |
| Allowed once | success border, "Allowed (once)" label | No actions |
| Allowed session | success border, "Allowed (session)" label | No actions |
| Denied | error border, "Denied" label | No actions |
| Timeout denied | warning border, "Denied (timeout)" label | No actions |

### 10.5 Interactions

- Buttons: primary (Allow once), secondary (Allow session), danger (Deny)
- Countdown: visible timer decrementing from 120s
- Composer blocked during pending permission (per [03-permission-ux.md](03-permission-ux.md) §7)
- Abort cancels pending permission

### 10.6 Accessibility

- `role="alertdialog"` when rendered as dialog; `role="region"` when inline
- Buttons clearly labeled; focus trapped in dialog mode
- Countdown announced periodically (every 30s) or on request

### 10.7 MVP constraints

- Inline card only (no dialog overlay mode in MVP, unless overlap case forces it)
- No "allow always" option (per [03-permission-ux.md](03-permission-ux.md))
- No risk-level customization

---

## 11. Composer

### 11.1 Purpose

Input area at the bottom of MainChat for composing and sending prompts. Supports multi-line, model/mode context display, and abort.

### 11.2 Anatomy

```text
+----------------------------------------------+
| [model: provider/model · mode badge]         |
| ───────────────────────────                  |
| textarea (auto-growing, min 1 line)          |
| placeholder: "Ask Codex to do anything"      |
| (D046; zh-CN 向 Codex 下达任意指令; home     |
|  variant "Ask anything" when project open,   |
|  D066)                                       |
| ───────────────────────────                  |
| [⏹ Abort (when running)] [→ Send / Enter]   |
+----------------------------------------------+
```

### 11.3 Layout

- Height: min 80px, max 320px (auto-grow with content)
- Background: bg-secondary
- Border: border-default top
- Padding: px-4 py-3 inner textarea
- Font: font-mono text-sm for agent mode; font-sans text-sm for chat mode
- Bottom-anchored: fixed at bottom of MainChat area

### 11.4 States

| State | Appearance | Actions |
|---|---|---|
| Idle (no model) | textarea active, send button disabled + tooltip "Configure a model first" | Send disabled |
| Idle (ready) | textarea active, send button enabled | Send active |
| Running | textarea disabled, abort button visible | Abort active, Send hidden |
| Permission pending | textarea disabled (per [03-permission-ux.md](03-permission-ux.md) §7) | Send disabled, abort visible |
| No workspace | textarea active, warning banner "No project — tools limited" | Send enabled |

### 11.5 Interactions

- Enter: send message (configurable: Shift+Enter for newline)
- Shift+Enter: newline in textarea
- Escape: when textarea focused, clears input or blurs (not abort)
- Abort: stops running turn and cancels pending permission
- Auto-grow: textarea expands with content up to max height, then scrolls internally

### 11.6 Accessibility

- `role="textbox"` with `aria-label="Message input"`
- Send button: `aria-label="Send message"`
- Abort button: `aria-label="Abort active turn"`
- Disabled send: `aria-disabled="true"` with tooltip explanation

### 11.7 MVP constraints

- No file attachment (deferred)
- No slash-command autocomplete in composer (command palette is separate)
- No voice input

---

## 12. ModelSelector

### 12.1 Purpose

Dropdown in Topbar showing current provider/model pair. Allows switching models within the current session.

### 12.2 Anatomy

```text
[provider icon] provider-name / model-name   [▼ dropdown arrow]
```

### 12.3 States

| State | Appearance |
|---|---|
| Configured | shows current provider/model, clickable |
| No provider | "Add provider" muted text + link to settings |
| Running | disabled, shows current model |
| Dropdown open | list of available models grouped by provider |

### 12.4 Interactions

- Click: opens dropdown with provider/model list
- Select: switches model for current session
- Keyboard: up/down arrow in dropdown, Enter to select, Escape to close

### 12.5 Accessibility

- `role="combobox"` with `aria-expanded`
- Current value announced via `aria-label`
- Dropdown items: `role="option"` with `aria-selected`

### 12.6 MVP constraints

- No model favorites/pinning
- No custom model creation from selector (use settings)
- Dropdown shows models from configured providers only

---

## 13. ProjectPicker

### 13.1 Purpose

Control in Topbar showing current workspace. Allows opening or clearing a project folder.

### 13.2 Anatomy

```text
[folder icon] /path/to/project   or   "No project"   [open button]
```

### 13.3 States

| State | Appearance |
|---|---|
| Active project | folder name shown, clickable path |
| No project | "No project" muted text + "Open folder" link |
| Opening | disabled, "Opening..." spinner |

### 13.4 Interactions

- Click path: opens system file dialog to select folder
- "Open folder": same action, explicit button
- "Clear project": command palette `builtin.project.clear`

### 13.5 Accessibility

- Current project: `aria-label="Current project: /path/to/project"`
- "No project": `aria-label="No project open"`
- Open button: `aria-label="Open project folder"`

### 13.6 MVP constraints

- No recent projects list (deferred)
- No multi-project tabs
- No project status indicators beyond path display

---

## 14. StatusBar

### 14.1 Purpose

Optional bottom bar showing runtime status indicators. **Deferred from MVP** — mentioned in IA but not implemented in M1–M3.

### 14.2 MVP constraints

- Not implemented in MVP
- Status indicators (running/error/idle) shown in Topbar instead
- Future: separate spec when implemented

---

## 15. Empty states

### 15.1 Purpose

Guidance surfaces when key data is absent. Must always provide an **action link**, not just a message.

### 15.2 States

| Context | Message | Action |
|---|---|---|
| No sessions | "Start your first conversation" | "New Chat" button → focus composer |
| No provider | "No model provider configured" | "Add provider" link → settings/providers |
| No project (Agent mode) | "No project open — local tools unavailable" | "Open folder" button → ProjectPicker |
| No project (Chat mode) | "Open a project for context" (muted warning) | "Open folder" button |
| Session empty (first message) | "Ask Codex to do anything" placeholder (home variant "Ask anything", D046/D066) | N/A |

### 15.3 Layout

- Centered in MainChat area
- Text-xl heading + text-sm description + primary action button
- Icon (48px Lucide) above heading
- Background: bg-primary (transparent, not a card)

### 15.4 Accessibility

- Action buttons are keyboard-focusable
- `aria-label` on icon providing context description

### 15.5 MVP constraints

- No animated empty-state illustrations
- No product tour overlays (per [05-onboarding.md](05-onboarding.md) §6)

---

## 16. Command palette surface

### 16.1 Purpose

Overlay surface for the command palette (Cmd/Ctrl+Shift+P, per D014). Defined in [04-builtin-commands.md](04-builtin-commands.md).

### 16.2 Anatomy

```text
+----------------------------------------------+
| [search input]                               |
| ───────────────────────────                  |
| Results list (scrollable)                    |
|   Category: Session                          |
|     ▸ New Chat                               |
|     ▸ Delete Current Session                 |
|   Category: Mode                             |
|     ▸ Switch to Chat Mode                    |
|     ▸ Switch to Agent Mode                   |
| ...                                          |
+----------------------------------------------+
```

### 16.3 Layout

- Position: centered overlay, max-width 480px, max-height 360px
- Background: bg-secondary, radius-lg, shadow-lg (light)
- Z-index: `z-command-palette` (60)
- Backdrop: semi-transparent bg-primary (0.5 opacity)

### 16.4 Interactions

- Search: filters commands by title and keywords
- Keyboard: arrow up/down navigate, Enter execute, Escape close
- Click: execute command

### 16.5 Accessibility

- `role="dialog"` with `aria-label="Command palette"`
- Focus trapped within palette while open
- Search input auto-focused on open
- Results: `role="listbox"` with `role="option"` per item

### 16.6 MVP constraints

- No sub-command nesting (flat list)
- No command history/recents
- Plugin commands appear alongside builtin commands

---

## 17. Toast

### 17.1 Purpose

Transient, non-blocking feedback for completed actions and failures that have no inline surface (background events, cross-page confirmations). One global stack — never per-page toast markup.

### 17.2 Anatomy

```text
                        ┌  toast-viewport (fixed top-center, z-toast) ┐
                        │  ┌──────────────────────────────────────┐ │
   newest, at anchor →  │  │ (✓)  Provider saved               ✕  │ │
                        │  ├──────────────────────────────────────┤ │
   oldest, pushed down →│  │ (i)  Message text                 ✕  │ │
                        │  └──────────────────────────────────────┘ │
                        └───────────────────────────────────────────┘
```

- `ToastHost` (in `components/Toast.tsx`) renders the stack; mounted once per shell branch in `App.tsx`
- Each card: 16px variant icon (semantic tint) · message · X dismiss button
- Surface: `bg-elevated-opaque` + 1px `border-subtle` + `shadow-dialog`, radius-md-plus — same floating family as menus; metrics in [07-ui-design-system.md §11.8](07-ui-design-system.md#118-toast)

### 17.3 API

State lives in the app store (`useAppStore`):

```ts
showToast(message: string, options?: {
  variant?: "info" | "success" | "warning" | "error"; // default "info"
  duration?: number; // ms; default 4000 (error 8000); 0 = sticky
});
dismissToast(id: number); // ToastHost internal / tests
```

### 17.4 Usage rules

| Rule | Detail |
|---|---|
| Variant semantics | `success` = a user action completed (saved, created, loaded). `error` = an operation failed (every `catch` path). `warning` = degraded/at-risk state that self-resolves. `info` = neutral notice (context echo, "not available yet"). |
| Errors always toast as `error` | `showToast(e instanceof Error ? e.message : String(e), { variant: "error" })` — never the default variant |
| No caller timers | Auto-dismiss is owned by the toast system; callers must not `setTimeout`-clear |
| i18n | Messages come from the i18n catalog (D073); raw host/provider error strings pass through unchanged |
| Not for blocking flows | Anything needing a decision uses PermissionDialog / dialog surfaces, not a toast |
| Not for inline validation | Field-level errors render next to the field; the chat error banner (`MODEL_NOT_CONFIGURED` etc.) stays inline |
| Host-pushed toasts | Plugin/main-process toasts arrive via `api.onToast` and render as `info` |

### 17.5 Behavior

- Auto-dismiss 4s (error 8s, `duration: 0` sticky); hovering a card pauses its timer, leaving resumes with remaining time
- Stack caps at 4 — oldest drops first; re-raising an identical message+variant restarts the existing toast instead of stacking a twin
- Newest toast enters at the top-center anchor (slide-down 200ms ease-out) pushing older cards down; exit is a 150ms ease-in fade
- Dismiss X always available; reduced motion keeps animations near-zero-duration so removal (bound to `animationend`) still fires

### 17.6 Accessibility

- Viewport is `aria-live="polite"`; `success`/`info` cards are `role="status"`, `warning`/`error` are `role="alert"`
- Dismiss button labeled with `toast.dismiss` catalog key
- Icons are `aria-hidden`; the variant is conveyed by the announced role, not color alone

### 17.7 MVP constraints

- No action buttons inside toasts (post-MVP; use the inline error banner for actionable errors)
- No progress/loading toasts — running state belongs to the working indicator
- No toast history surface

---

## 18. Acceptance criteria (all components)

1. All components use semantic color tokens from [07-ui-design-system.md](07-ui-design-system.md) — no raw hex
2. All interactive elements have visible focus rings (2px accent, offset 2px)
3. Layout shell metrics (46px titlebar row, ~275/48 sidebar, 280 context, 80–320 composer) match spec (D034/D070)
4. Chat messages constrained to 720px max width
5. ToolCallCard shows status, args preview, result preview, duration per [01-ui-ia.md](01-ui-ia.md) §5
6. PermissionCard shows tool name, risk, args, countdown, and three action buttons per [03-permission-ux.md](03-permission-ux.md)
7. Composer: Enter sends, Shift+Enter newline, disabled during running/pending, abort button visible during run
8. ModelSelector shows provider/model pair; disabled during stream; links to settings when unconfigured
9. Command palette opens at z-index 60, traps focus, supports keyboard navigation
10. Empty states always provide an actionable next step, not just a message
11. All components have correct ARIA roles and labels
12. Responsive collapse works at 800px and 640px breakpoints
13. Toasts stack top-center with variant icon + dismiss, auto-dismiss 4s/8s, pause on hover, and announce via `role="status"`/`role="alert"` per §17
