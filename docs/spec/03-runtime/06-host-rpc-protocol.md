# 06. Host RPC Protocol

## 1. Goal

Define the local protocol between:

- Electron main (orchestrator)
- Rust host-core (privileged backend)
- Node pi agent sidecar (tool requester / event source consumer via host)

MVP transport decision (**D001**):

> **stdio JSON-RPC over NDJSON**

## 2. Transport

- Process: Electron main spawns Rust host-core sidecar
- Channel: child process stdin/stdout
- Framing: one JSON object per line (NDJSON)
- Encoding: UTF-8
- Request/response: JSON-RPC 2.0 style

### Request

```json
{
  "jsonrpc": "2.0",
  "id": "req_01H...",
  "method": "tools.execute",
  "params": {}
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "id": "req_01H...",
  "result": {}
}
```

### Error

```json
{
  "jsonrpc": "2.0",
  "id": "req_01H...",
  "error": {
    "code": 1003,
    "message": "PATH_OUTSIDE_WORKSPACE",
    "data": {
      "errorCode": "PATH_OUTSIDE_WORKSPACE",
      "details": {}
    }
  }
}
```

### Notification (server → client, no id)

```json
{
  "jsonrpc": "2.0",
  "method": "permissions.request",
  "params": {}
}
```

## 3. Handshake

On spawn, Electron must call:

### `app.handshake`

Params:

```ts
type HandshakeParams = {
  protocolVersion: 1
  client: "electron-main"
  clientVersion: string
  locale: string // default "en"
}
```

Result:

```ts
type HandshakeResult = {
  protocolVersion: 1
  host: "rust-host-core"
  hostVersion: string
  features: string[]
}
```

Rules:

1. If protocol major version mismatches → abort boot
2. Electron should exit with actionable error if handshake fails
3. All subsequent calls require successful handshake

## 4. Method catalog (MVP)

### App
- `app.handshake`
- `app.health`
- `app.getVersion`

### Workspace
- `workspace.get`
- `workspace.set`
- `workspace.clear`

### Secrets
- `secrets.set`
- `secrets.delete`
- `secrets.has`
- // never `secrets.get` to renderer logs

### Settings
- `settings.get`
- `settings.set`

### Sessions
- `session.list`
- `session.create`
- `session.get`
- `session.delete`
- `session.rename`
- `session.appendMessage`
- `session.updateTurn`

### Tools
- `tools.list`
- `tools.execute`
- `tools.abort`

### Permissions
- `permissions.evaluate`
- `permissions.resolve`
- `permissions.listSessionGrants`
- `permissions.clearSessionGrants`

### Plugins
- `plugins.list`
- `plugins.loadDev`
- `plugins.installFromPath`
- `plugins.enable`
- `plugins.disable`
- `plugins.uninstall`
- `plugins.getPermissions`

### Audit
- `audit.append`
- `audit.query` (optional later)

## 5. Tool execute contract

### `tools.execute` params

```ts
type ToolsExecuteParams = {
  sessionId: string
  turnId?: string
  toolCallId: string
  toolName: string
  args: unknown
  mode: "chat" | "agent"
  timeoutMs?: number
}
```

### result

```ts
type ToolsExecuteResult = {
  toolCallId: string
  ok: boolean
  isError?: boolean
  content: unknown
  durationMs: number
  denied?: boolean
  errorCode?: string
}
```

## 6. Permission request notification

Host may emit:

```ts
method: "permissions.request"
params: {
  requestId: string
  sessionId: string
  toolCallId: string
  toolName: string
  risk: "low" | "medium" | "high"
  argsPreview: unknown
  reason: string
  timeoutMs: 120000
}
```

Electron/UI resolves via:

```ts
method: "permissions.resolve"
params: {
  requestId: string
  decision: "allow-once" | "allow-session" | "deny"
}
```

Timeout behavior (**D005**): after 120s unresolved → deny.

## 7. Error codes

| code | errorCode | meaning |
|---|---|---|
| 1000 | INTERNAL | unexpected host failure |
| 1001 | UNAUTHORIZED | missing/invalid handshake or capability |
| 1002 | INVALID_PARAMS | schema validation failed |
| 1003 | PATH_OUTSIDE_WORKSPACE | path sandbox violation |
| 1004 | TOOL_DENIED | permission denied |
| 1005 | TOOL_TIMEOUT | tool exceeded timeout |
| 1006 | WORKSPACE_REQUIRED | no workspace bound |
| 1007 | NOT_FOUND | entity missing |
| 1008 | CONFLICT | busy/conflict state |
| 1009 | PLUGIN_INVALID | manifest/validation failure |
| 1010 | PLUGIN_LOAD_FAILED | enable/load failure |
| 1011 | PROTOCOL_MISMATCH | handshake version mismatch |

## 8. Concurrency / ordering

1. Requests may be concurrent, but tools for the same `sessionId` execute serially by default
2. Notifications may arrive anytime after handshake
3. Abort should be best-effort and idempotent

## 9. Logging rules

- Never log API keys/secrets
- Tool args may be redacted in audit previews
- Every tools.execute gets trace id = `toolCallId`

## 10. Acceptance

1. Electron spawns host and completes handshake
2. health method returns ok
3. denied tool path returns `TOOL_DENIED`
4. timeout path returns deny decision after 120s
