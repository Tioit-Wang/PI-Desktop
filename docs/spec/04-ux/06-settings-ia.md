# 06. Settings Information Architecture

## 1. Settings root (Codex full-page shell)

Settings is a **full-window page** that replaces the app sidebar + main chrome (Codex electron behavior):

- Left settings rail only (sidebar surface `#f4f4f4` light / `#000` dark), **~275px** (Codex gold at 1200-wide)
- Top of rail: traffic-light clearance, **Back to app** (`返回应用`), pill **Search settings…**
- The 46px top band across both the rail and content pane is a native window
  drag region; interactive controls remain explicitly non-draggable
- Grouped navigation with icons:
  1. **Personal** — General, Appearance, Voice, Configuration, Personalization, Pets, Keyboard shortcuts, Account (+ local-first Providers, About)
  2. **Integrations** — Appshots, Plugins, Browser, Computer use (+ local-first MCP servers after Codex order)
  3. **Coding** — Hooks, Connections, Git
- Main content pane on primary surface with large section title + elevated rounded cards of rows

## 2. Section contents

### General
- **Permissions** card:
  - Default permissions (toggle)
  - Auto-review (toggle) + inline blue **Learn more** link to sandboxing docs
  - Full access permissions (toggle) + risk copy + **Learn more**
- **General** card (Codex row set):
  - Default file open target (pill select with VS Code glyph)
  - Language (pill select, Auto detect)
  - Show in menu bar (toggle)
  - Bottom panel (toggle)

### Appearance
- theme system/light/dark (select + theme cards)

### Configuration
- default mode + default model id
- Enter to send (local preference; not on Codex General gold)

### Providers (local-first)
- add provider form + configured list (API key never shown raw)

### Plugins
- installed list, enable/disable/uninstall, load dev plugin

### Other Codex sections
- scaffolded empty/placeholder cards until host features land (MCP, Browser, Computer use, Hooks, Connections, Git, Voice, Personalization, Pets, Appshots, Keyboard, Account)

### About
- app/host/protocol versions + open logs

## 3. Navigation rules

- Profile footer / command palette open Settings full page (default General)
- Composer model menu can deep-link Providers
- Back to app returns to chat shell

## 4. Acceptance

1. Opening Settings hides the coding app sidebar (full-page takeover)
2. Rail shows Codex groups + icons + search + back
3. General shows Permissions (with Learn more) + General cards matching Codex row set
4. Open-target control shows VS Code glyph in the pill
5. Provider secrets never display raw key values
6. Row descriptions use semantic secondary text and maintain at least 4.5:1
   contrast against their card surface in both light and dark themes
7. Dragging the empty top band from either side of Settings moves the native
   window without blocking Back, search, or navigation controls

## 5. General chrome metrics (Codex gold)

Measured against `cx-settings-try` / `cx-settings-cmdcomma` (~1200×690):

| Token | Value |
|---|---|
| Rail width | ~275px |
| Rail light bg | `#f4f4f4` |
| Active nav pill | denser 6px/10px pad, ~8px radius, gray mix on rail |
| Section title | 28px / 560, first baseline ~y70 |
| Content max | ~720px, left-aligned in pane |
| Card radius | ~14px elevated stroke |
| Toggle | **32×20** thumb 16, accent blue on (not green) |
| Account external | arrow-up-right only (no box) |
| Open-target pill | leading VS Code glyph |

Local-first **Providers** + **About** remain after Account in Personal; they are intentional PI extensions and shift lower groups vs pure Codex gold (accepted residual).

