# 06. Settings Information Architecture

## 1. Settings root (Codex full-page shell)

Settings is a **full-window page** that replaces the app sidebar + main chrome (Codex electron behavior):

- Left settings rail only (sidebar surface `#f3f3f3` light / `#000` dark)
- Top of rail: traffic-light clearance, **Back to app** (`返回应用`), pill **Search settings…**
- Grouped navigation with icons:
  1. **Personal** — General, Appearance, Voice, Configuration, Personalization, Providers, Keyboard shortcuts, Account, About
  2. **Integrations** — Plugins, MCP servers, Browser, Computer use
  3. **Coding** — Hooks, Connections, Git
- Main content pane on primary surface with large section title + elevated rounded cards of rows

## 2. Section contents

### General
- **Permissions** card: default permissions / auto-review / full access (toggle rows; host wiring later where needed)
- **General** card: enter to send, default mode, show in menu bar

### Appearance
- theme system/light/dark (select + theme cards)

### Providers (local-first)
- add provider form + configured list (API key never shown raw)

### Configuration
- default mode + default model id

### Plugins
- installed list, enable/disable/uninstall, load dev plugin

### Other Codex sections
- scaffolded empty/placeholder cards until host features land (MCP, Browser, Computer use, Hooks, Connections, Git, Voice, Personalization, Keyboard, Account)

### About
- app/host/protocol versions + open logs

## 3. Navigation rules

- Profile footer / command palette open Settings full page (default General)
- Composer model menu can deep-link Providers
- Back to app returns to chat shell

## 4. Acceptance

1. Opening Settings hides the coding app sidebar (full-page takeover)
2. Rail shows Codex groups + icons + search + back
3. General shows Permissions + General cards with row/toggle density
4. Provider secrets never display raw key values
