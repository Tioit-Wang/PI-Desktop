# 08. Error Codes

## 1. Goal

Provide one stable error vocabulary across:

- Renderer UI
- Electron IPC
- Rust host RPC
- Node pi sidecar bridge

## 2. Error object

```ts
type AppError = {
  code: string            // stable machine code, e.g. TOOL_DENIED
  message: string         // English UI/default message
  details?: unknown
  retriable?: boolean
  source?: "renderer" | "electron" | "host" | "agent" | "plugin"
  causeCode?: string      // nested/transport code if mapped
  traceId?: string
}
```

Rules:

1. `code` is immutable once published
2. `message` is English source text (i18n key may map separately)
3. UI should prefer i18n key derived from `code` when available

## 3. Code registry

### 3.1 App / protocol

| code | retriable | meaning |
|---|---|---|
| `PROTOCOL_MISMATCH` | no | handshake/protocol version mismatch |
| `HOST_UNAVAILABLE` | yes | Rust host not running/reachable |
| `AGENT_UNAVAILABLE` | yes | pi sidecar not running/reachable |
| `APP_DEGRADED` | yes | app running with limited capabilities |
| `INTERNAL` | maybe | unexpected internal failure |
| `INVALID_ARGUMENT` | no | request schema/args invalid |
| `UNAUTHORIZED` | no | capability/auth boundary rejected call |
| `NOT_FOUND` | no | entity not found |
| `CONFLICT` | maybe | state conflict / busy resource |
| `TIMEOUT` | yes | generic timeout |

### 3.2 Agent / session

| code | retriable | meaning |
|---|---|---|
| `AGENT_BUSY` | no | session already has active turn |
| `AGENT_NOT_FOUND` | no | session missing |
| `TURN_NOT_FOUND` | no | turn id invalid |
| `TURN_ABORTED` | no | turn aborted by user/system |
| `MODEL_NOT_CONFIGURED` | no | no usable model selected |
| `PROVIDER_ERROR` | yes | upstream provider failure |
| `PROVIDER_UNAUTHORIZED` | no | bad/missing provider credentials |
| `PROVIDER_RATE_LIMITED` | yes | provider rate limited |
| `CONTEXT_TOO_LARGE` | no | prompt/context exceeds limit |
| `STREAM_FAILED` | yes | stream interrupted unexpectedly |

### 3.3 Workspace / tools / permissions

| code | retriable | meaning |
|---|---|---|
| `WORKSPACE_REQUIRED` | no | no workspace bound |
| `PATH_OUTSIDE_WORKSPACE` | no | path escapes sandbox |
| `TOOL_NOT_FOUND` | no | unknown tool |
| `TOOL_DENIED` | no | permission denied / mode forbidden |
| `TOOL_TIMEOUT` | yes | tool execution timeout |
| `TOOL_FAILED` | maybe | tool executed but failed |
| `PERMISSION_TIMEOUT` | no | permission prompt timed out (mapped to deny) |
| `PERMISSION_REQUIRED` | no | waiting for user decision |
| `BASH_DISABLED_IN_CHAT` | no | chat mode hard-deny for bash |
| `WRITE_DISABLED_IN_CHAT` | no | chat mode hard-deny for write/edit |

### 3.4 Secrets / settings

| code | retriable | meaning |
|---|---|---|
| `SECRET_MISSING` | no | required API key missing |
| `SECRET_STORE_UNAVAILABLE` | maybe | OS secure storage unavailable |
| `SETTINGS_INVALID` | no | settings payload invalid |

### 3.5 Plugins

| code | retriable | meaning |
|---|---|---|
| `PLUGIN_NOT_FOUND` | no | plugin id missing |
| `PLUGIN_INVALID` | no | manifest/package invalid |
| `PLUGIN_LOAD_FAILED` | maybe | enable/load failed |
| `PLUGIN_DISABLED` | no | plugin disabled |
| `PLUGIN_PERMISSION_DENIED` | no | plugin lacks declared/granted permission |
| `PLUGIN_COMMAND_NOT_FOUND` | no | command id missing |
| `PLUGIN_CRASHED` | yes | plugin runtime crashed |
| `PLUGIN_CONTRACT_MISMATCH` | no | unsupported manifest/api version |

## 4. Mapping rules

### Host RPC numeric → AppError.code
See `06-host-rpc-protocol.md` numeric table.  
Example: host `1004` → `TOOL_DENIED`.

### Provider exceptions
Node sidecar maps provider SDK errors into:

- `PROVIDER_UNAUTHORIZED`
- `PROVIDER_RATE_LIMITED`
- `PROVIDER_ERROR`
- `STREAM_FAILED`

### Permission timeout
UI/host timeout emits `PERMISSION_TIMEOUT` internally, tool result presented as denied (`TOOL_DENIED`) to agent.

## 5. UI handling guidelines

| class | UI behavior |
|---|---|
| auth/config (`SECRET_MISSING`, `MODEL_NOT_CONFIGURED`) | blocking CTA to settings |
| permission denials | inline tool card state |
| retriable provider/network | show retry action |
| internal/host unavailable | degraded banner + recovery tip |

## 6. i18n key convention

```text
errors.<code>
errors.<code>.action
```

Examples:

- `errors.SECRET_MISSING`
- `errors.SECRET_MISSING.action`
- `errors.HOST_UNAVAILABLE`

## 7. Acceptance

1. Every IPC failure returns `AppError.code`
2. No raw untyped string-only failures on main paths
3. Chat hard-denies use explicit mode codes
4. Host numeric codes map to stable string codes

## Provider / model errors

| code | http-ish | retryable | notes |
|---|---|---|---|
| `PROVIDER_AUTH_FAILED` | 401/403 | no | bad/missing credentials |
| `PROVIDER_BASE_URL_INVALID` | 400 | no | endpoint invalid |
| `PROVIDER_PROTOCOL_MISMATCH` | 400 | no | wrong protocol profile |
| `PROVIDER_MODEL_NOT_FOUND` | 404 | no | unknown model id |
| `PROVIDER_RATE_LIMITED` | 429 | yes | quota/rate |
| `PROVIDER_TIMEOUT` | 504 | yes | network/server timeout |
| `PROVIDER_UNSUPPORTED_CAPABILITY` | 422 | no | tools/vision/etc unsupported |
| `PROVIDER_STREAM_INTERRUPTED` | 503 | yes | mid-stream drop |
| `PROVIDER_SECRET_MISSING` | 400 | no | enabled provider needs secret |
| `PROVIDER_DISABLED` | 400 | no | provider disabled |

## Workspace / tool output errors

| code | retryable | notes |
|---|---|---|
| `WORKSPACE_PATH_DENIED` | no | ignore/denylist/security block |
| `WORKSPACE_OUTSIDE_ROOT` | no | path escapes workspace |
| `TOOL_RESULT_TRUNCATED` | n/a | informational marker path |
| `TOOL_BINARY_CONTENT` | no | refused binary dump |
| `TOOL_TIMEOUT` | maybe | bash/tool deadline |

