# 01. UI Information Architecture

> Language: English (per ADR 0009). This describes the shipped Codex-aligned
> shell (D034+). Component detail: [08-component-spec](08-component-spec.md);
> visual tokens: [07-ui-design-system](07-ui-design-system.md); behavior:
> [09-interaction-patterns](09-interaction-patterns.md).

## 1. Goal

A clear, restrained, developer-first workbench: one window, one active
destination, chat as the home surface, tools and permissions inline.

## 2. Shell regions

```text
+--------------------------------------------------------------+
| Titlebar row (46px): traffic lights · back/forward · actions |
+------------------+-------------------------------------------+
| Sidebar (~275px) | Main pane (active destination)            |
|  New task        |  chat home / transcript                   |
|  Projects        |  or Projects / Plugins page               |
|  Plugins         |  [Context panel overlays on toggle]       |
|  Current project |                                           |
|  Temporary       |                                           |
|  Footer: Custom  |  Floating composer (chat destination)     |
+------------------+-------------------------------------------+
```

- **Sidebar**: primary navigation — New task, destination entries
  (Projects / Plugins), one current-project session group, a path-less
  Temporary sessions group, and the profile footer (Custom → Settings / Logs /
  Theme, D041/D088). Pull requests and Scheduled are intentionally omitted
  from the home sidebar. Other projects remain in the Projects index rather
  than accumulating in the home sidebar. Collapsible to an icon rail
  (Cmd/Ctrl+B).
- **Main pane**: exactly one destination at a time; destinations replace the
  pane (they are pages, not modals).
- **Titlebar**: hiddenInset traffic lights; back/forward controls traverse
  destination history; context-panel toggle on the right.
- **Composer**: workspace-agnostic floating pill anchored to the chat
  destination — split-grow centered on the empty home (D045/D047),
  bottom-docked in a transcript, with no project / Local / branch rail (D095).
- **Backend status capsule**: appears under the titlebar while the backend
  restarts or is fatally degraded (D080), with an Open-logs action.

## 3. Destinations

### 3.1 Chat home (default)
- Empty state: hero title ("What should we build?" — project name becomes a
  dotted-underline button when a workspace is open), suggestion cards
  (D049/D067), centered composer.
- With transcript: message stream + tool disclosure rows (D071), docked
  composer, permission cards inline.

### 3.2 Projects
Codex index table (search, name/sources/updated columns, expand, actions;
D066). The durable D086 `projects` table is the index source of truth, so
imported sessions with project paths immediately materialize corresponding
project rows without switching the current workspace. Opening/switching a
project rebinds the selected workspace and tool scope.

### 3.3 Pull requests
Segmented Open/Draft/All filters with counts; rows carry icon plate, number,
title, status badge, branch meta, external link, and "Review with agent"
(creates a chat turn). Requires an active workspace and `gh`.

### 3.4 Scheduled
Create card + task rows (cadence/enabled badges, prompt preview, last run,
Run now / toggle / Delete). Run now opens a session seeded with the prompt.

### 3.5 Plugins
Installed plugin list (enable/disable/uninstall), dev-load entry, permission
declarations.

### 3.6 Settings (full-page takeover)
Settings replaces the whole shell (D063): back-to-app + search + a compact
four-destination rail in the exact order General / Configuration /
Import sessions / About (D090), with elevated content cards.
Appearance lives inside General; provider management lives inside
Configuration. Import sessions scans supported local agent stores and presents
candidates in collapsible groups. Project path is an alternate grouping
alongside the default source grouping, and every scan or grouping change starts
with all groups collapsed. Plugin management remains solely on the app shell's
independent Plugins destination described in §3.5.

## 4. Overlays

| Overlay | Trigger | Notes |
|---|---|---|
| Command palette | Cmd/Ctrl+K (also Cmd/Ctrl+Shift+P per D014) | builtin + plugin commands |
| Permission dialog | tool permission request | risk copy, args preview, allow-once / allow-session / deny, 120s countdown → deny |
| Context panel | titlebar toggle | project/status/context info |
| Model menu | composer model chip | configured provider/model choices + settings entry (D091) |
| Profile menu | sidebar footer | Settings / Logs / Theme cycle (D041) |
| Toasts | events (plugin toast, backend restored, copy) | top-center; 4s default, 8s for errors |

## 5. Navigation model

- `page` state: `chat | projects | pulls | scheduled | plugins | settings`.
- Destination history is linear; titlebar back/forward traverse it.
- Selecting a current-project thread switches to `chat` within that project.
  Selecting a temporary thread clears the active workspace before loading it.
- New task reuses an existing empty draft in the same project or temporary
  scope instead of stacking drafts (D088; US-UI-11).

## 6. Keyboard map (IA level)

| Keys | Action |
|---|---|
| Cmd/Ctrl+K, Cmd/Ctrl+Shift+P | command palette |
| Cmd/Ctrl+B | toggle sidebar |
| Cmd/Ctrl+. | abort current run |
| Enter / Shift+Enter | send / newline (configurable Enter-to-send) |
| Esc | dismiss overlay/menu |

## 7. State-dependent chrome

- No provider configured → blocking guidance toward Settings before first run
  (`MODEL_NOT_CONFIGURED`).
- No workspace → home hero without project underline; Pull requests shows a
  workspace-required empty state. The composer never renders a workspace rail.
- Backend degraded → status capsule (restarting) or fatal banner with Open
  logs (D080); composer submits are rejected with readable errors while down.

## 8. i18n

English is the source locale; zh-CN ships in parallel for shell chrome
(labels asserted by US-UI e2e scenarios). Copy rules live in
[02-i18n-english-first](02-i18n-english-first.md).
