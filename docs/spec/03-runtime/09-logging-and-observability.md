# 09. Logging and Observability

## 1. Goals

1. Diagnose failures quickly
2. Audit sensitive tool/plugin actions
3. Avoid leaking secrets
4. Keep MVP simple (local files first)

## 2. Log levels

- `debug`
- `info`
- `warn`
- `error`

Default runtime level:

- dev: `debug`
- release: `info`

## 3. Channels

| channel | content | location |
|---|---|---|
| app | boot, ipc, window, process supervision | `~/.pi-desktop/logs/app.log` |
| host | rust host-core events | `~/.pi-desktop/logs/host.log` |
| agent | pi sidecar turn/provider events | `~/.pi-desktop/logs/agent.log` |
| audit | permissions/tools/plugins sensitive actions | `~/.pi-desktop/logs/audit.log` |
| plugin | per-plugin logs | `~/.pi-desktop/plugins/logs/<id>.log` |

## 4. Required fields

Every structured log line should include:

```ts
type LogRecord = {
  ts: string
  level: "debug" | "info" | "warn" | "error"
  channel: string
  message: string
  traceId?: string
  sessionId?: string
  turnId?: string
  toolCallId?: string
  pluginId?: string
  code?: string
  data?: unknown
}
```

Format MVP: NDJSON files.

## 5. What must be logged

### Always
- app boot/shutdown
- host/agent spawn + handshake result
- session create/delete
- prompt accepted/aborted
- tool start/end
- permission request/decision/timeout
- plugin enable/disable/load/error

### Never
- API keys / raw secrets
- full secure storage payloads
- unnecessary full file contents for huge reads in audit (use hashes/previews)

## 6. Redaction rules

1. Keys matching `/token|secret|password|api[_-]?key/i` redacted
2. Authorization headers redacted
3. Tool args preview truncated (e.g. 2KB)
4. Long command output truncated in audit, full output optional in host debug only

## 7. Trace correlation

Use one `traceId` per user-visible action when possible:

- prompt → turnId
- tool call → toolCallId
- permission flow shares toolCallId/requestId

Renderer, Electron, host, agent should propagate these IDs.

## 8. User-facing diagnostics

MVP provides:

1. in-app error text with code
2. “Open logs folder” command
3. optional copy error details (code + traceId)

Not in MVP:

- remote telemetry pipeline
- cloud crash analytics (can be added later behind consent)

## 9. Retention

- app/host/agent logs: keep recent N files / size-capped rotation
- audit logs: longer retention than debug logs
- exact rotation numbers implementation-defined, but must not grow unbounded

## 10. Acceptance

1. Failed tool call can be traced by toolCallId across logs
2. secrets never appear in log files during normal flows
3. logs folder openable from app/command palette
