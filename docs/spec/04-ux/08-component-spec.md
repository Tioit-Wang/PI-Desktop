# 08. Component Spec

> Layout and IA reference: [01-ui-ia.md](01-ui-ia.md)  
> Design tokens and foundations: [07-ui-design-system.md](07-ui-design-system.md)  
> Interaction behavior: [09-interaction-patterns.md](09-interaction-patterns.md)


> Shell layout is Codex-aligned: left thread sidebar (~275px), main transcript, floating bottom composer with mode/model controls. Prefer neutral charcoal surfaces over blue-slate chrome.
>
> **Precedence rule**: where a metric or copy string below disagrees with a
> Codex parity decision in [decisions-log §D](../08-meta/decisions-log.md)
> (D034+), the decision log wins — it tracks the live gold captures. Known
> updated values: sidebar ~275px (not 240px), toolbar 46px (not 44px),
> composer placeholder per D094/D066, home split-grow per D045/D047,
> Projects index table per D066, settings full-page shell per D063 with the
> compact four-destination directory from D090, and retained path-keyed
> project groups per D093 (which preserves D088's Temporary/exact-path boundary
> while restoring scoped project and conversation organization actions), and
> product branding/icon contract per D094.

## 1. AppShell

### 1.1 Purpose

Outer frame that positions Topbar, Sidebar, MainChat, and WorkPanel. Owns resize logic, responsive collapse, and theme class.

### 1.2 Anatomy

```text
+------------------+------------------------------+------------------+
| Sidebar          | MainChat                     | WorkPanel        |
| (275px / 48px)   | (flex-1)                     | (320–720px /     |
|                  |                              |  hidden)         |
+------------------+------------------------------+------------------+
| Titlebar row: 46px, traffic lights at {x:16,y:16} (D034/D070)      |
+--------------------------------------------------------------------+
```

### 1.3 States

| State | Behavior |
|---|---|
| Default | Sidebar expanded, work panel hidden |
| Narrow (<640px) | Sidebar auto-collapses to icon rail |
| Narrow window with panel open | Work panel width re-clamps to 60vw |
| Fullscreen | Topbar remains; sidebar/panel toggle |

### 1.4 Interactions

- Sidebar toggle: keyboard shortcut + hamburger button in topbar
- Work panel toggle: Cmd/Ctrl+J + panel button in topbar
- Work panel resize: left-edge drag handle (§5.4)
- Window resize: responsive collapse per [07-ui-design-system.md](07-ui-design-system.md) §10.1

### 1.5 Accessibility

- Landmark roles: `<nav>` for sidebar, `<main>` for chat, `<aside>` for work panel, `<header>` for topbar
- Tab sequence: topbar → sidebar → main chat → work panel → composer

### 1.6 MVP constraints

- Sidebar width is fixed; only the work panel drag-resizes
- The main pane renders one active transcript and one selected workspace while
  the sidebar may retain several project tabs/groups
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

Scoped project and session navigation and management. The expanded sidebar
shows every retained project tab as an independently collapsible group plus
path-less Temporary sessions; the collapsed state is an icon rail. Retained
tabs are renderer presentation state, not additional host workspaces.
The home destination controls expose Projects and Plugins only; Pull requests
and Scheduled are not rendered in the sidebar.

### 3.2 Anatomy

```text
Expanded (~275px, D034/D070):
+---------------------------+
| [π] PI-Desktop            |
| [message+ New Chat] button |
| Projects / Plugins        |
| project-A      [v] [+] … |
|   • Project session      |
| project-B      [>] [+] … |
| Temporary sessions   [+] |
|   • Path-less session   |
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
| Active project | Header carries active state; topbar follows that workspace; composer exposes no workspace identity |
| Collapsed project | Header remains visible; child conversations are hidden |
| Archived row | Hidden by default; visible in the explicit archived view |
| No retained project | Compact Open project entry; Temporary rows remain available |
| Empty group | Muted one-line empty state; group create action remains available |

### 3.4 Interactions

- Click project identity/switch action: activate its path through the existing
  `project.set` bridge and retain the other project groups
- Click project disclosure: expand/collapse only that group
- Click session: activate its bound project when necessary, switch the active
  session, and scroll to the last message
- Click the message-plus New Chat control: create/reuse a draft in the current workspace scope
- Click project `+`: activate that project and create/reuse a session bound to
  its exact path
- Click Temporary sessions `+`: clear the workspace and create/reuse a
  path-less persistent session
- Project overflow: switch, pin/unpin, archive/restore, close retained tab
- Conversation overflow: pin/unpin, archive/restore, delete
- Sort menu: Recently updated, Created date, Oldest first, and Name; pinned
  rows stay ahead of unpinned rows. A stored `manual` compatibility value
  requires no drag-reorder UI.
- Sidebar toggle: Topbar hamburger + keyboard shortcut

### 3.5 Accessibility

- Project and Temporary headings have localized names; each disclosure and `+`
  has a scope-specific accessible name
- Session groups use semantic `section` containers
- Active session: `aria-current="true"`
- Project disclosure: `aria-expanded`; menu check/radio items expose
  `aria-checked`
- Collapsed state: each icon has `aria-label` with session title
- Keyboard: arrow keys navigate session list


### 3.6 Brand and icon contract

- The visible shell name is `PI-Desktop`; Codex is not used as the renderer
  identity.
- `BrandLogo` imports canonical `build/icon_1024.png` through Vite. The
  empty-home hero renders it at 56px, the expanded/collapsed sidebar at
  15px/18px, and the docked composer at 15px.
- The expanded/collapsed New task control and project/Temporary session
  creation controls render the dedicated message-plus session icon. Generic
  `IconPlus` remains reserved for adding non-session entities.
- Icons are decorative when a localized text label or accessible name is
  present; click, keyboard, and focus behavior remain unchanged.

### 3.7 MVP constraints

- No sidebar search (deferred per [01-ui-ia.md](01-ui-ia.md))
- No drag-to-reorder contract; `manual` is a persisted compatibility value
- Project tabs do not create another host workspace or a second main pane

### 3.8 Project group contract

Each retained project is one labeled `section` keyed by normalized full path.
The header owns project-level controls; the child list owns conversation-level
controls.

| Element | Contract |
|---|---|
| Group root | localized project name; full path in tooltip/accessible description |
| Disclosure | independent `aria-expanded`; toggling never activates or archives |
| Project pin | presentation priority only; no host row deletion/move |
| Project archive | omitted from default view; restorable from archived view |
| Project close | removes retained tab only; durable project/sessions remain |
| Session list | exact-path matches only; no basename grouping |
| Active group | exactly one group reflects the selected host workspace |
| Background state | running/error indicator updates by session without replacing the visible transcript |

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

## 5. WorkPanel

> Replaces the former ContextPanel overlay. The workspace/model/status
> summary it carried lives in the composer chips and Settings.

### 5.1 Purpose

Docked right work column for inspecting and steering the agent's workspace:
Review (working-tree diff), Terminal (interactive PTY), Browser (embedded
preview), and Files (workspace browser). Codex-parity surface.

### 5.2 Anatomy

```text
+--------------------------------------+
| [审阅|终端|浏览器|文件]        [×]   |  header 46px, drag region
+--------------------------------------+
| Active tab body                      |
|  Review: file cards + unified diff   |
|  Terminal: xterm host                |
|  Browser: URL bar + preview surface  |
|  Files: tree + file viewer           |
+--------------------------------------+
^ 6px resize handle on the left edge
```

### 5.3 States

| State | Behavior |
|---|---|
| Closed (default) | Not rendered; titlebar toggle inactive |
| Open | Docked flex column right of the main pane; width 320–min(720, 60vw) |
| Resizing | Live width follows pointer; committed (and persisted) on release |
| No workspace | Each tab renders its own "open a project" empty state |
| Narrow window | Width re-clamps on window resize |

### 5.4 Interactions

- Toggle: titlebar panel button or Cmd/Ctrl+J; close button in the header.
- Tab switch: segmented control; selecting a tab also opens the panel when
  driven programmatically. Terminal stays mounted across switches so the PTY
  and scrollback survive; other tabs mount on demand.
- Resize: pointer drag on the left-edge handle.
- Persistence: `{open, tab, width}` in localStorage `pi.desktop.workPanel`.

### 5.5 Accessibility

- `<aside>` landmark; tab strip is a `nav` with `aria-label`
- Resize handle: `role="separator"` `aria-orientation="vertical"`
- Close button and every tab expose localized titles

### 5.6 MVP constraints

- Tab content specs: Review diff is read-only (no line comments yet);
  Browser is user-driven (no agent control); Files is read-only
- Single panel instance; no per-tab detach or split

---

## 6. SessionList

### 6.1 Purpose

List user sessions by execution context inside the sidebar. It exposes the
sessions for every retained project tab plus persistent sessions that have no
project. Pin/archive/collapse state is a presentation over durable host
sessions, not a replacement persistence model.

### 6.2 Anatomy

Groups and session items:

```text
[folder] current-project                         [+]
           Session title
[folder] another-project                         [+]
           Session title
[panel]  Temporary sessions                      [+]
           Session title
```

### 6.3 States

| State | Appearance |
|---|---|
| Active | accent bg highlight, text-primary |
| Inactive | bg-secondary, text-secondary |
| Hover (inactive) | bg-tertiary |
| Running | accent pulse on left border |
| Error | error dot indicator |
| Pinned | ordered before unpinned rows within the selected sort |
| Archived | omitted by default; shown only when archived view is enabled |

### 6.4 Interactions

- Click: activate session
- Project matching uses the normalized full project path, never only the folder
  basename.
- Sessions for retained paths appear beneath their corresponding project
  group. Sessions for closed paths remain discoverable from the Projects index.
- Selecting a temporary session clears the active workspace so session and
  tool context do not imply project access.
- Pin/archive actions update renderer presentation metadata; delete remains
  the explicit durable host operation.
- Selecting a conversation with a different project first activates that
  project's workspace. A running turn in the previously selected session is
  not aborted.
- Keyboard: arrow up/down, Enter to select
- Delete: row menu or command palette `builtin.session.delete`

### 6.5 Accessibility

- Each group is a labeled `section`.
- Scope-specific create buttons expose localized `aria-label` values.
- Active rows expose the selected visual state and retain their full title in
  a tooltip.
- Archived state and running/error status are announced rather than conveyed
  by color alone.

### 6.6 MVP constraints

- Search remains a local title filter; archive visibility and ordering are
  local view controls rather than host queries.
- Temporary means **not bound to a project**, not ephemeral storage; these
  sessions survive restart.
- All project groups and the Temporary group share one independently scrollable
  sidebar region.

---

## 7. ChatTranscript

### 7.1 Purpose

Scrollable container rendering the ordered sequence of user messages, assistant
responses, lightweight tool activity rows, and permission cards for a session.

### 7.2 Anatomy

```text
+----+-------------------------------------+
|map | [User MessageBubble]                |
|rail| [Thinking disclosure]               |
|    | [Assistant MessageBubble]           |
|    |   [ToolCallRow]                     |
|    |   [PermissionCard] (interrupt)      |
|    | [Assistant MessageBubble (resume)]  |
|    | [User MessageBubble]                |
|    | ...                                 |
+----+-------------------------------------+
```

### 7.3 States

| State | Behavior |
|---|---|
| Streaming | New tokens append; auto-scroll only while pinned to bottom |
| Thinking-only streaming | Transcript opens; disclosure stays open; no empty answer bubble or duplicate Working row |
| Idle | Scrollable; no auto-scroll |
| Permission pending | PermissionCard inserted inline; transcript continues after resolution |
| Error | Error MessageBubble with actionable retry link |

### 7.4 Interactions

- Scroll: user scroll pauses auto-scroll; "scroll to bottom" floating button appears
- Hover message: copy action appears
- Toggle Thinking disclosure: expand/collapse reasoning independently from the
  final answer; streaming reopens it while reasoning is arriving
- Hover code block: copy button appears
- Hover or focus a minimap marker: show the localized sender and a bounded
  plaintext preview; nearby markers magnify horizontally without reflowing the
  rail
- Click a minimap marker: smoothly scroll its message near the top of the
  transcript viewport
- Scroll the transcript: update the active minimap marker against an anchor
  near the upper third of the viewport

### 7.5 Accessibility

- `role="log"` container
- `aria-live="polite"` for new content announcements
- Each message: `role="article"` with `aria-label` describing sender
- Thinking uses a button disclosure with `aria-expanded` and `aria-controls`;
  the localized label distinguishes Show thinking from Hide thinking, and the
  collapsed panel is hidden from accessibility and focus traversal
- The minimap is a localized navigation landmark; every marker is a button
  labeled with its message sender
- The marker nearest the reading position exposes `aria-current="true"` and
  keyboard focus opens the same preview available on pointer hover

### 7.6 MVP constraints

- No message search within transcript
- No message branching/rewind
- The minimap renders only when at least two visible user or assistant messages
  exist; tool-only rows do not create markers
- Marker previews are capped at 280 source characters and are display-only

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
| [Thinking ▾]                             |
|   separate reasoning markdown (optional) |
| ──────────────────────────────────────── |
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
- Thinking: separate lightweight disclosure above the answer with no card
  background or outer border. Its Sparkles/chevron trigger uses secondary text,
  and the expanded markdown is indented by a subtle theme-token left rule. It
  is never concatenated into answer markdown.
- Gap: space-3 between consecutive messages
- Font: text-base (14px) for body; text-sm (13px) mono for code

### 8.4 States

| State | Appearance |
|---|---|
| Streaming | pulsing left border accent; content grows |
| Thinking streaming | disclosure open; answer bubble omitted until answer text exists |
| Complete | no pulse; full rendered markdown |
| Error | error border; error message inline with retry prompt |

### 8.5 Accessibility

- User: `aria-label="User message"`
- Assistant: `aria-label="Assistant message"`
- Thinking trigger exposes localized Show/Hide labels, `aria-expanded`, and an
  `aria-controls` relationship to the reasoning panel
- Timestamps: `aria-label` with full time string, visual shows relative time

### 8.6 MVP constraints

- No message reactions/annotations
- No edit user message (deferred)
- Copy assistant answer excludes thinking text

### 8.7 Markdown & code rendering (implemented)

Renderer: `apps/desktop/src/components/Markdown.tsx` + `apps/desktop/src/lib/shiki.ts`.

- **Streaming without jank**: source splits into top-level blocks via `marked`'s
  lexer; each block renders through a memoized `<ReactMarkdown>`. While
  streaming only the tail block re-parses (incremental re-lex from the last
  block boundary), so cost stays linear in message length.
- **Plugins**: `remark-gfm` (tables, task lists, strikethrough, autolinks),
  `remark-math` + `rehype-katex` (inline `$…$`, display `$$…$$`). Raw HTML
  stays escaped (no `rehype-raw`).
- **Syntax highlighting**: Shiki singleton with the JavaScript regex engine
  (no wasm), themes `github-light`/`github-dark` following `data-theme`.
  Languages lazy-load per fence tag with a plain-mono fallback until ready.
  Streaming code re-tokenizes only changed lines by chaining GrammarState
  (per-line cache), so per-frame cost is constant regardless of block size.
- **Code block chrome**: `.code-block` card (radius-md-plus, hairline border,
  `--gray-1000` dark / `#f3f3f3` light) with `.code-block-head` — language tag
  (text-xs, muted) left, persistent copy button right (copies the raw code
  string). Body `pre` at text-sm-plus / leading-relaxed with horizontal
  scroll.
- **Prose**: heading ramp h1 `text-lg-plus` → h4+ `text-base` (semibold,
  tracking-tight), token-based lists/task lists/blockquote/hr/kbd/img; tables
  wrap in `.table-wrap` (rounded hairline shell, horizontal scroll).
- **Links**: rendered with `target="_blank"` so the main process routes them
  through `shell.openExternal`; in-window navigation stays blocked.
- **Typewriter**: rAF-driven reveal (speed scales with backlog);
  `prefers-reduced-motion` renders the buffer verbatim. `.thread-scroll` sets
  `overflow-anchor: none` (pinned-follow owns the scroll position) and
  `.message-row` uses `content-visibility: auto` for long transcripts.

---

## 9. ToolCallRow

### 9.1 Purpose

Lightweight inline disclosure row showing a semantic tool action, its primary
argument hint, status, input, and output. It follows D071 and is intentionally
not an elevated card.

Consecutive tool calls form one ChatGPT-style processing group. The group is
collapsed by default and its header shows `Processing · 12s` while active or
`Processed for 12s` after completion. Expanding it reveals the ordered tool
activity rows and their nested input/output disclosures.

### 9.2 Anatomy

```text
[sparkle] Processed for 12s  3 steps      [›]
          ├─ [file] Read /src/foo.ts      [›]
          ├─ [search] Searched tool-row   [›]
          └─ [terminal] Ran pnpm test     [›]
```

- The leading Lucide icon reflects the action type: file, folder, search,
  edit, terminal, web, or generic tool.
- The group header owns the elapsed timer and step count. It stays in the
  transcript after completion and remains collapsed unless explicitly opened.
- The visible label is a natural-language action (`Read`, `Ran`, `Searched`),
  not the raw function name. Running actions use the progressive form.
- The primary argument is a clamped single-line monospace hint.
- The disclosure chevron is quiet until hover/focus or expansion.

### 9.3 Layout

- Outer row: transparent, borderless, shadowless, approximately 24px high
- Icon: 15–16px; disclosure chevron: 12px
- Header gap: 4px; expanded body inset: 24px
- Input/output: `font-mono text-sm`, independently copyable, capped at 220px
  with internal scrolling
- Only expanded content receives an inset surface and subtle border

### 9.4 States

| State | Header treatment | Expanded content |
|---|---|---|
| Running | Progressive action + shimmer + spinner | Latest partial output |
| Success | Past-tense action; no green success badge | Final output, then raw input |
| Error | Past-tense action + compact danger status; auto-expanded | Error output, then raw input |
| Denied | Muted `Denied` status | Permission result when available |

### 9.5 Interactions

- Click the row: expand/collapse output and input; successful rows default
  collapsed and failed rows open automatically.
- Click the processing header: expand/collapse the ordered activity list.
  Processing groups default collapsed, including while the turn is active.
- Failed groups use an explicit `Failed after {elapsed}` header. Expansion uses
  a short height/opacity transition and keeps collapsed content inert.
- Running updates replace the latest partial output in place.
- Output is presented before raw input so the primary result has higher
  information priority.
- Input and output each expose a compact copy action.
- Host truncation markers remain visible and cannot be bypassed by expansion.

### 9.6 Accessibility

- `role="region"` with `aria-label="Tool call: {toolName}"`
- Status announced through localized `aria-label` text
- Expand/collapse: `aria-expanded` + `aria-controls`
- Keyboard focus uses the standard inset focus ring

### 9.7 MVP constraints

- No inline diff rendering for Edit/Write results
- No file path click-to-open (deferred)
- No cross-row activity grouping until turn boundaries are available to the
  transcript component

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
| textarea (auto-growing, 1 line → max 7)      |
| placeholder: "Ask PI-Desktop to do anything"      |
| (D094; zh-CN 向 PI-Desktop 下达任意指令; home     |
|  variant "Ask anything" when project open,   |
|  D066)                                       |
| ───────────────────────────                  |
| [⏹ Abort (when running)] [→ Send / Enter]   |
+----------------------------------------------+
```

### 11.3 Layout

- Height: compact one-line shell by default; textarea auto-grows through seven
  visible lines, then the textarea scrolls internally
- Workspace context: no project, Local, or branch rail is rendered or
  reserved above the shell in either home or thread-docked mode (D095)
- Background: one solid semantic composer surface; no internal gradient,
  background image, or decorative wash
- Elevation: 20px radius with a hairline stroke and restrained soft shadow;
  the docked transcript fade is outside the composer shell
- Border: border-default top
- Padding: px-4 py-3 inner textarea
- Font: font-mono text-sm for agent mode; font-sans text-sm for chat mode
- Bottom-anchored: fixed at bottom of MainChat area

### 11.4 States

| State | Appearance | Actions |
|---|---|---|
| Idle (no model) | textarea active, send button disabled + tooltip "Configure a model first" | Configuration link remains available in model menu |
| Idle (ready) | textarea active, send button enabled | Send active |
| Running | textarea disabled, abort button visible | Abort active, Send hidden |
| Permission pending | textarea disabled (per [03-permission-ux.md](03-permission-ux.md) §7) | Send disabled, abort visible |
| No workspace | textarea active, warning banner "No project — tools limited" | Send enabled |

### 11.5 Interactions

- Enter: send message (configurable: Shift+Enter for newline)
- Shift+Enter: newline in textarea
- Escape: when textarea focused, clears input or blurs (not abort)
- Abort: stops running turn and cancels pending permission
- Auto-grow: textarea measures wrapped visual lines, starts at one visible
  line, expands through seven lines, then scrolls internally; deleting content
  shrinks it back to one line
- Chat / Agent and provider/model changes update the active session, not the
  app default. They are disabled while a turn runs.
- The model menu lists only enabled, runnable providers with a default model.
- The model menu always shows a dedicated Thinking section and current level.
  For the exact active provider/model, it renders only supported levels in a
  compact grid, canonical order, and persists a selection with the complete
  session config without closing the menu.
- Unknown Custom/OpenAI-compatible models can enable an explicit reasoning
  override from the same section. The provider refreshes, the session selects
  the supported level nearest `medium`, and known non-reasoning models remain
  unavailable rather than receiving an override.
- Switching provider preserves an available level, otherwise uses the nearest
  supported level (upward first, then downward); a non-reasoning provider
  persists `off`.

### 11.6 Accessibility

- `role="textbox"` with `aria-label="Message input"`
- Send button: `aria-label="Send message"`
- Abort button: `aria-label="Abort active turn"`
- Disabled send: `aria-disabled="true"` with tooltip explanation
- Thinking levels use radio-menu semantics inside a localized Thinking group;
  the selected level exposes `aria-checked="true"`

### 11.7 MVP constraints

- No file attachment (deferred)
- No image/appshot attachment stubs
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

- Project selection may activate a retained tab or add a new local project
  tab; the host still exposes one selected workspace
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
| No provider | "No model provider configured" | "Add provider" link → Settings → Configuration → Providers |
| No project (Agent mode) | "No project open — local tools unavailable" | "Open folder" button → ProjectPicker |
| No project (Chat mode) | "Open a project for context" (muted warning) | "Open folder" button |
| Session empty (first message) | "Ask PI-Desktop to do anything" placeholder (home variant "Ask anything", D094/D066) | N/A |

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

## 18. SessionImportPanel

### 18.1 Purpose

Scan supported local agent stores, review discovered sessions in manageable
groups, select candidates, and start an explicit import.

### 18.2 Anatomy

```text
[Found N sessions]  [Group by: Source ▾]  [Import selected (N)]
──────────────────────────────────────────────────────────────────
[ ] [›] Claude Code                                      N sessions
[ ] [›] Codex                                            N sessions
```

- The grouping control supports **Project path** and **Source**.
- Source is the default grouping.
- In project-path mode, exact paths remain visible in group headers.
- Sessions without a project path appear in a final **No project** group.
- Each group header includes group selection, disclosure, label, and count.
- Import source names, grouping controls, counts, results, and accessible names
  come from the shared i18n catalog. Candidate dates use the active app locale.

### 18.3 States and interactions

- A successful scan replaces the prior candidate set, clears selection, and
  leaves every group collapsed.
- A successful import creates or reuses one durable Projects-index entry for
  each distinct non-empty project path and refreshes sessions/projects.
- Path-less imports create no project entry and remain under Temporary
  sessions. Import never creates a physical filesystem directory.
- Re-importing an existing source session skips it without duplicating its
  project entry.
- Changing the grouping mode preserves candidate selection but collapses every
  newly formed group.
- Expanding or collapsing one group does not affect the others.
- Group and global checkboxes support checked, unchecked, and indeterminate
  selection states as applicable.
- Candidates inside each group and groups themselves are ordered newest first;
  the path-less group remains last in project-path mode.

### 18.4 Accessibility

- Each disclosure button exposes `aria-expanded` and references its body with
  `aria-controls`.
- Global and group checkboxes have localized accessible names.
- The grouping selector has a visible label and is keyboard-operable.
- Projects-row disclosure and action-menu buttons expose localized,
  project-specific accessible names.

---

## 19. Acceptance criteria (all components)

1. All components use semantic color tokens from [07-ui-design-system.md](07-ui-design-system.md) — no raw hex
2. All interactive elements have visible focus rings (2px accent, offset 2px)
3. Layout shell metrics (46px titlebar row, ~275/48 sidebar, 280 context,
   compact composer with 1–7-line draft growth) match spec
4. Chat messages constrained to 720px max width
5. ToolCallCard shows status, args preview, result preview, duration per [01-ui-ia.md](01-ui-ia.md) §5
6. PermissionCard shows tool name, risk, args, countdown, and three action buttons per [03-permission-ux.md](03-permission-ux.md)
7. Composer: Enter sends, Shift+Enter newline, draft grows from one through
   seven visible lines then scrolls, disabled during running/pending, abort
   button visible during run
8. ModelSelector shows provider/model pair; disabled during stream; links to settings when unconfigured
9. Command palette opens at z-index 60, traps focus, supports keyboard navigation
10. Empty states always provide an actionable next step, not just a message
11. All components have correct ARIA roles and labels
12. Responsive collapse works at 800px and 640px breakpoints
13. Toasts stack top-center with variant icon + dismiss, auto-dismiss 4s/8s, pause on hover, and announce via `role="status"`/`role="alert"` per §17
14. Session import defaults to source grouping, offers project-path grouping, collapses all groups after scan/group changes, and exposes accessible group disclosure state per §18
15. Imported project paths materialize exactly once in the durable Projects index; path-less imports remain Temporary sessions and no filesystem directory is created
