# 03. Tools and Permissions

> Decisions applied: D003, D004, D005, D006, D013, D015

## 0. Frozen policy summary

| Topic | Decision |
|---|---|
| Default mode | Agent |
| Chat tools | Read / Glob / Grep only |
| Agent tools | Read / Glob / Grep / Write / Edit / Bash |
| Permission timeout | 120s → deny |
| allow-session scope | toolName |
| Bash style (M3) | non-interactive (no PTY) |

## 1. Goal

Let the agent get things done, but stay under control by default.

## 2. MVP Built-in Tools

| Tool | Risk | Description |
|---|---|---|
| `Read` | low | Read files within the workspace |
| `Glob` | low | List files by pattern |
| `Grep` | low | Content search |
| `Write` | high | Create/overwrite files |
| `Edit` | high | Modify files |
| `Bash` | high | Execute commands |

> Names may be fine-tuned during implementation, but semantics stay consistent.

## 3. Common Tool Constraints

Every tool must have:

1. JSON schema / typebox parameter definition
2. timeout
3. workspace path validation
4. output truncation policy
5. trace id
6. structured results

## 4. Path Rules

- All file paths are relative to `workspaceRoot` by default
- After normalization they must still reside within the workspace
- `..` escapes are forbidden
- Symlinks that escape the workspace are rejected
- When no workspace is set, high-risk tools are unavailable

## 5. Bash Rules

MVP baseline:

- A workspace is required
- Default cwd = workspaceRoot
- Confirmation required by default
- Set a timeout (e.g. 60s, configurable)
- Capture stdout/stderr
- Truncate large output
- No interactive TTY (MVP)

Initial denylist (extensible):

- Directly reading/writing sensitive paths outside the workspace
- Destructive operations without confirmation (policy governed by the permission layer)

## 6. Permission Model

### Risk Levels

| risk | Example | Default policy |
|---|---|---|
| low | Read/Glob/Grep | Auto-allow |
| medium | low-risk network/metadata | Confirm or allow by policy |
| high | Write/Edit/Bash | Confirm by default |

### Decision Types

- `allow-once`
- `allow-session`
- `deny`

May be added later:
- `allow-always-for-tool`
- `allow-always-for-command-pattern`

## 7. Permission Flow

```text
tool call
 → policy.evaluate()
 → allow? execute
 → need confirm? push to UI
 → deny? return tool error result
```

Permission confirmation timeout:
- After 120s, auto-deny (D005: fail closed, do not hang forever)

## 8. Tool Result Visibility to the Model

- Success result: given to the model
- Failure result: given to the model (with error info)
- User denial: give the model an explicit "user denied permission"
- Sensitive info: redact before persisting/displaying

## 9. Auditing

Each tool call records:

- sessionId
- turnId
- toolCallId
- toolName
- args hash / preview
- decision
- duration
- success / error code

MVP may start by writing to SQLite or a log file.

## 10. Mode matrix (Chat vs Agent)

| Mode | Read/Glob/Grep | Write/Edit | Bash |
|---|---|---|---|
| Chat | allow | deny | deny |
| Agent | allow | confirm | confirm |

### Notes
- Chat mode hard-denies high-risk tools before permission UI
- Agent mode uses permission cards for Write/Edit/Bash
- allow-session is remembered per toolName for the active session only

## 11. Plugin Tools

Plugins can contribute tools via `agentTools`:

1. manifest declaration
2. user grants `agent.tool.register`
3. PluginManager registers them into the ToolHost
4. execution goes through the unified permission/audit/timeout wrapper

Naming:
- Internal full name: `plugin.<pluginId>.<toolName>`
- Name exposed to the model: forced prefix `plugin_<pluginIdSafe>_<toolName>` (D015) to avoid conflicts

## 12. Future Extensions

- MCP tools
- tool group toggles
- command allowlist / denylist
- dry-run mode
- apply patches after preview
