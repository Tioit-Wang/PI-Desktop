# 04. Builtin Commands

## 1. Goal

Define first-party command palette entries available without plugins.

Shortcut: **Cmd/Ctrl + Shift + P** (D014)

## 2. Command ID convention

```text
builtin.<domain>.<action>
```

## 3. MVP builtin catalog

| id | title | keywords | category | risk | behavior |
|---|---|---|---|---|---|
| `builtin.session.new` | New Chat | new, chat, session | Session | low | create session and focus composer |
| `builtin.session.delete` | Delete Current Session | delete, session | Session | medium | confirm then delete active session |
| `builtin.session.rename` | Rename Current Session | rename, session | Session | low | open rename UI |
| `builtin.mode.chat` | Switch to Chat Mode | mode, chat, readonly | Mode | low | set session mode=chat |
| `builtin.mode.agent` | Switch to Agent Mode | mode, agent | Mode | low | set session mode=agent |
| `builtin.agent.abort` | Abort Active Turn | abort, stop | Agent | low | abort current turn/permission wait |
| `builtin.project.open` | Open Project | open, project, folder | Project | low | open folder picker and bind workspace |
| `builtin.project.clear` | Clear Project | clear, project | Project | low | unbind workspace |
| `builtin.settings.open` | Open Settings | settings, preferences | App | low | navigate settings root |
| `builtin.settings.providers` | Open Provider Settings | provider, model, key | Settings | low | navigate providers page |
| `builtin.settings.permissions` | Open Permission Settings | permissions, grants | Settings | low | navigate permissions page |
| `builtin.plugins.open` | Open Plugins | plugins, extensions | Plugins | low | navigate plugins page |
| `builtin.plugins.loadDev` | Load Development Plugin | load, dev, plugin | Plugins | medium | choose local plugin directory |
| `builtin.commandPalette.show` | Show Command Palette | palette, commands | App | low | open palette |
| `builtin.app.reloadWindow` | Reload Window | reload, window | App | low | renderer reload |
| `builtin.app.toggleDevtools` | Toggle DevTools | devtools, debug | Debug | low | toggle devtools (dev/nightly) |
| `builtin.logs.open` | Open Logs | logs, diagnostics | Diagnostics | low | open logs panel/path |

> Keep MVP set small. Plugin commands extend this list dynamically.

## 4. Visibility rules

- Debug commands may be hidden in production release builds
- Plugin management commands always available
- Project commands available even without active session

## 5. Execution results

Commands return:

```ts
type CommandExecutionResult =
  | { ok: true; navigation?: string; message?: string }
  | { ok: false; error: AppError }
```

## 6. Acceptance

1. All builtin IDs are unique and prefixed
2. Palette search matches title/keywords
3. Mode switch commands update session mode immediately
4. Abort command works during stream and permission pending
