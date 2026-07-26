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
  protocolVersion: 3
  client: "electron-main"
  clientVersion: string
  locale: string // default "en"
}
```

Result:

```ts
type HandshakeResult = {
  protocolVersion: 3
  host: "rust-host-core"
  hostVersion: string
  features: string[]
}
```

Rules:

1. If protocol major version mismatches → abort boot
2. Electron should exit with actionable error if handshake fails
3. All subsequent calls require successful handshake
4. Version 3 is required for durable regenerate revisions; a version 2 host
   must be rejected before chat becomes interactive

## 4. Method catalog (MVP)

### App
- `app.handshake`
- `app.health`
- `app.getVersion`

### Workspace
- `workspace.get`
- `workspace.set`
- `workspace.clear`

### Projects
- `projects.list` — returns durable project records ordered pinned-first, then
  by last-opened time; includes records materialized by session imports

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
- `session.create` — accepts optional `thinkingLevel`; missing/null defaults
  to `off`
- `session.get`
- `session.delete`
- `session.rename`
- `session.configure` — atomically persists `mode`, `providerId`, `modelId`,
  and optional `thinkingLevel` for the next pi turn; omitting/null
  `thinkingLevel` preserves the current value; invalid modes or levels return
  `INVALID_PARAMS`
- `session.appendMessage`
- `session.replaceMessages` — single-transaction transcript rewrite used by
  regenerate/edit flows
- `session.saveRevision` — archive a regenerate branch under
  `(sessionId, rootUserId)`
- `session.listRevisions` — list linear variants for a root user family
- `session.activateRevision` — replace live transcript with `prefix + branch`
  and stamp root pager metadata
- `session.updateTurn`
- `session.import` — atomically imports one converted session; a non-empty
  project path is normalized and upserted into `projects` before the session
  references it; returns `{ imported, skipped }`

Canonical thinking levels at the host boundary are:

```text
off | minimal | low | medium | high | xhigh | max
```

Session summaries/details always return `thinkingLevel`. Assistant messages
may return `thinking`; host storage maps it to a canonical content block rather
than appending it to answer `content`.

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

Workspace resolution is session-scoped:

1. Host loads `sessionId` and resolves its persisted `project_id`/path.
2. That path becomes the tool sandbox root for permission preview, execution,
   artifact paths, and audit context.
3. The mutable `workspace.get` selection is not consulted for a valid durable
   session, so switching a retained project tab cannot redirect a background
   call.
4. A durable path-less session resolves no root and receives
   `WORKSPACE_REQUIRED` where the tool requires one. A selected project is not
   inherited.
5. Legacy calls whose session does not exist may temporarily fall back to the
   selected workspace; new renderer flows must always provide a valid
   `sessionId`.
6. A database/session-resolution error returns `INTERNAL` and fails closed;
   only a confirmed missing session may use the legacy fallback.

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
2. Different sessions may continue concurrently across retained project tabs;
   each resolves its own project root and grants
3. Notifications may arrive anytime after handshake
4. Abort should be best-effort and idempotent

## 9. Logging rules

- Never log API keys/secrets
- Tool args may be redacted in audit previews
- Every tools.execute gets trace id = `toolCallId`

## 10. Acceptance

1. Electron spawns host and completes handshake
2. health method returns ok
3. denied tool path returns `TOOL_DENIED`
4. timeout path returns deny decision after 120s
5. switching the selected workspace from A to B does not change the tool root
   of a call issued by session A
