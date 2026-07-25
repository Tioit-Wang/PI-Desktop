# 01. IPC Protocol

## 1. Goal

Define a stable contract between the renderer and main.

Principles:

1. All capabilities go through the preload allowlist
2. Requests/responses are typed
3. Long-running tasks use event streams, not a single oversized response
4. Errors must have a code + message

## 2. API Groups

| Domain | Description |
|---|---|
| `app` | App info, health checks |
| `agent` | Conversation, abort, status |
| `session` | Session CRUD / history |
| `settings` | Config read/write |
| `secrets` | Secret write/delete/exists (never return plaintext to UI logs) |
| `project` | Workspace selection and query |
| `tool` | Permission confirmation callback |
| `log` | Diagnostics that the frontend can display |
| `plugin` | Plugin install/enable-disable/query/permissions |
| `commandPalette` | Command palette search and execution |

## 3. Channel Conventions

```text
invoke: pi-desktop/<domain>/<action>
event: pi-desktop/<domain>/event/<name>
```

Examples:

- `pi-desktop/agent/prompt`
- `pi-desktop/agent/abort`
- `pi-desktop/agent/event/message`
- `pi-desktop/session/list`
- `pi-desktop/project/open`

## 4. Common Response Envelope

```ts
type Result<T> =
 | { ok: true; data: T }
 | { ok: false; error: AppError };

type AppError = {
 code: string;
 message: string;
 details?: unknown;
 retriable?: boolean;
};
```

## 5. Agent API

### 5.1 prompt

```ts
type AgentPromptRequest = {
 sessionId: string;
 content: string;
};

type AgentPromptResponse = {
 accepted: boolean;
 turnId: string;
};
```

Prompt execution resolves `mode`, `providerId`, and `modelId` from the durable
session record. The renderer changes those values through
`pi-desktop/session/configure` while the session is idle:

```ts
type SessionConfigureRequest = {
  id: string;
  mode: "chat" | "agent";
  providerId?: string;
  modelId?: string;
};
```

Image and file payloads are not part of the current prompt contract. Composer
attachment affordances remain hidden until main, sidecar, pi model
capabilities, and persistence all consume the payload.

### 5.2 abort

```ts
type AgentAbortRequest = {
 sessionId: string;
 turnId?: string;
};
```

### 5.3 getStatus

```ts
type AgentStatus = {
 sessionId: string;
 isRunning: boolean;
 currentTurnId?: string;
 modelId?: string;
 pendingToolConfirmations: number;
};
```

## 6. Agent Events

Pushed from main → renderer:

```ts
type AgentEventEnvelope = {
 sessionId: string;
 turnId?: string;
 ts: number;
 event: AgentEvent;
};

type AgentEvent =
 | { type: "agent_start" }
 | { type: "agent_end"; messageIds: string[] }
 | { type: "turn_start" }
 | { type: "turn_end" }
 | { type: "message_start"; message: UiMessage }
 | { type: "message_update"; message: UiMessage; deltaText?: string }
 | { type: "message_end"; message: UiMessage }
 | { type: "tool_start"; toolCallId: string; toolName: string; args: unknown }
 | { type: "tool_update"; toolCallId: string; partialResult?: unknown }
 | { type: "tool_end"; toolCallId: string; result: unknown; isError?: boolean }
 | { type: "tool_permission_request"; request: ToolPermissionRequest }
 | { type: "error"; error: AppError }
 | { type: "status"; status: AgentStatus };
```

> These are **UI-normalized events**, not a pass-through of raw pi events.
> `packages/agent-runtime` is responsible for mapping pi events to this model.

## 7. Session API

```ts
type SessionSummary = {
 id: string;
 title: string;
 projectPath?: string;
 modelId?: string;
 updatedAt: string;
 createdAt: string;
};

type SessionDetail = SessionSummary & {
 messages: UiMessage[];
};
```

Minimal interface:

- `session/list`
- `session/create`
- `session/get`
- `session/delete`
- `session/rename`
- `session/importScan`
- `session/importRun(candidates) -> { imported, skipped, failed }`

Import candidates carry `projectPath: string | null`. A successful import
refreshes both sessions and the durable Projects index.

## 8. Settings / Secrets API

### settings
Non-sensitive config that can be returned to the UI:

- provider list (without secret plaintext)
- default model
- permission policy toggles
- UI preferences

### secrets
- `secrets/set(providerId, apiKey)`
- `secrets/delete(providerId)`
- `secrets/has(providerId) -> boolean`

Forbidden:
- Writing the full API key into ordinary logs
- Holding API key plaintext long-term in the renderer

## 9. Project API

- `project/open()`: system directory picker
- `project/get()`: current workspace
- `project/list()`: durable project records, including import-created entries
- `project/set(path)`: set workspace
- `project/clear()`

Returns:

```ts
type ProjectWorkspace = {
 path: string;
 name: string;
};

type ProjectRecord = {
 id: number;
 path: string;
 name: string;
 pinned: boolean;
 createdAt: number;
 lastOpenedAt: number;
};
```

## 10. Tool Permission API

When a tool requires confirmation:

1. main sends `tool_permission_request`
2. UI shows a confirmation card
3. UI calls `tool/resolvePermission`

```ts
type ToolPermissionRequest = {
 requestId: string;
 sessionId: string;
 toolCallId: string;
 toolName: string;
 argsPreview: unknown;
 risk: "low" | "medium" | "high";
 reason: string;
};

type ToolPermissionResolution = {
 requestId: string;
 decision: "allow-once" | "allow-session" | "deny";
};
```

## 11. Version Compatibility

- IPC contract version field: `protocolVersion: 1`
- Breaking changes must bump the version and record an ADR
- renderer and main validate the version at startup; on mismatch, prompt to upgrade/reinstall

## 12. Plugin API (host UI side)

Minimal interface:

- `plugin/list`
- `plugin/loadDev(path)`
- `plugin/installFromPath(path)`
- `plugin/enable(id)`
- `plugin/disable(id)`
- `plugin/uninstall(id)`
- `plugin/getPermissions(id)`
- `plugin/setPermission(id, permission, allowed)` (optional fine-grained)

Returned summary:

```ts
type PluginSummary = {
 id: string
 name: string
 version: string
 enabled: boolean
 source: "installed" | "dev"
 status: "ready" | "error" | "disabled"
 errorMessage?: string
 permissions: string[]
}
```

## 13. Command Palette API

- `commandPalette/search(query)`
- `commandPalette/execute(commandId)`

Command sources:
- Built-in commands
- Plugin contributes.commands

## 14. Error Codes — Initial registry (extensible)

| code | Meaning |
|---|---|
| `AGENT_BUSY` | The current session already has a running turn |
| `AGENT_NOT_FOUND` | Session does not exist |
| `MODEL_NOT_CONFIGURED` | No available model |
| `PROVIDER_SECRET_MISSING` | Missing API key |
| `TOOL_DENIED` | Permission denied |
| `TOOL_TIMEOUT` | Tool timed out |
| `WORKSPACE_REQUIRED` | Project directory required |
| `PATH_OUTSIDE_WORKSPACE` | Path out of bounds |
| `INTERNAL` | Uncategorized internal error |
