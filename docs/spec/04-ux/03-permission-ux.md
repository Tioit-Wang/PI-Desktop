# 03. Permission UX

## 1. Goal

Make high-risk local actions visible, interruptible, and predictable.

## 2. Mode matrix

| Mode | Read/Glob/Grep | Write/Edit | Bash |
|---|---|---|---|
| Chat | allow | deny | deny |
| Agent | allow | confirm | confirm |

Decision source: **D003/D004**.

## 3. Decision types

- `allow-once`
- `allow-session` (scoped by toolName, **D006**)
- `deny`

No `allow-always` in MVP.

## 4. Permission card states

```text
pending → allowed_once
pending → allowed_session
pending → denied
pending → timeout_denied
```

## 5. Timeout

- Default timeout: **120 seconds**
- On timeout: auto `deny`
- UI shows timeout state explicitly
- Agent receives tool error result: user denied / timed out

## 6. Card content requirements

Must show:

1. tool name
2. risk level
3. short reason
4. args preview (redacted if needed)
5. workspace context
6. actions: Allow once / Allow for session / Deny

## 7. Composer interaction while pending

- user may continue editing text
- sending another prompt in same session is blocked while turn waits on permission
- Abort cancels turn and pending permission request

## 8. Session grants surface

Active session grants (toolName, grantedAt, clear action) remain runtime-owned.
A durable grants-management surface is deferred until a host-backed settings
schema exists; Settings must not render a control that cannot persist or affect
the permission runtime.

## 9. Acceptance

1. Chat mode cannot execute Bash/Write/Edit
2. Agent mode prompts for high-risk tools
3. timeout becomes deny in UI + tool result
4. allow-session suppresses repeat prompts for same toolName only
