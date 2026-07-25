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
|  Recents (pins)  |                                           |
|  Footer: Custom  |  Floating composer (chat destination)     |
+------------------+-------------------------------------------+
```

- **Sidebar**: primary navigation — New task, destination entries
  (Projects / Plugins), Recents thread list (with pin + open-in-panel row
  actions, D068), and the profile footer (Custom → Settings / Logs / Theme,
  D041). Pull requests and Scheduled are intentionally omitted from the home
  sidebar. Collapsible to an icon rail (Cmd/Ctrl+B).
- **Main pane**: exactly one destination at a time; destinations replace the
  pane (they are pages, not modals).
- **Titlebar**: hiddenInset traffic lights; back/forward controls traverse
  destination history; context-panel toggle on the right.
- **Composer**: floating pill anchored to the chat destination — split-grow
  centered on the empty home (D045/D047), bottom-docked in a transcript.
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
D066). Opening/switching a project rebinds the workspace for tools and chips.

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
Settings replaces the whole shell (D062/D063): back-to-app + search + grouped
rail (Personal / Integrations / Coding), elevated content cards. Providers
and Plugins management live here; General holds permissions, appearance,
language, and configuration rows (D064/D065).

## 4. Overlays

| Overlay | Trigger | Notes |
|---|---|---|
| Command palette | Cmd/Ctrl+K (also Cmd/Ctrl+Shift+P per D014) | builtin + plugin commands |
| Permission dialog | tool permission request | risk copy, args preview, allow-once / allow-session / deny, 120s countdown → deny |
| Context panel | titlebar toggle | project/status/context info |
| Plus menu | composer `+` | attach files/photos, capture appshot (stub), open project |
| Model/effort menu | composer model chip | effort radio + model heading + settings entry (D040) |
| Profile menu | sidebar footer | Settings / Logs / Theme cycle (D041) |
| Toasts | events (plugin toast, backend restored, copy) | top-center; 4s default, 8s for errors |

## 5. Navigation model

- `page` state: `chat | projects | pulls | scheduled | plugins | settings`.
- Destination history is linear; titlebar back/forward traverse it.
- Selecting a recent thread switches to `chat` with that session.
- New task reuses an existing empty draft instead of stacking drafts (D-series
  "empty draft reuse"; US-UI-11).

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
- No workspace → home hero without project underline; composer chips hidden
  on empty home (D056); Pull requests shows workspace-required empty state.
- Backend degraded → status capsule (restarting) or fatal banner with Open
  logs (D080); composer submits are rejected with readable errors while down.

## 8. i18n

English is the source locale; zh-CN ships in parallel for shell chrome
(labels asserted by US-UI e2e scenarios). Copy rules live in
[02-i18n-english-first](02-i18n-english-first.md).
