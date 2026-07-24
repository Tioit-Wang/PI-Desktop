# 05. IPC Protocol

## 1. 目标

定义 renderer 与 main 之间的稳定契约。

原则：

1. 所有能力走 preload 白名单
2. 请求/响应类型化
3. 长任务用事件流，不用超大一次性返回
4. 错误必须有 code + message

## 2. API 分组

| Domain | 说明 |
|---|---|
| `app` | 应用信息、健康检查 |
| `agent` | 对话、中断、状态 |
| `session` | 会话 CRUD / 历史 |
| `settings` | 配置读写 |
| `secrets` | 密钥写/删/是否存在（不回传明文到 UI 日志） |
| `project` | 工作区选择与查询 |
| `tool` | 权限确认回传 |
| `log` | 前端可展示的诊断信息 |
| `plugin` | 插件安装/启停/查询/权限 |
| `commandPalette` | 命令面板检索与执行 |

## 3. Channel 约定

```text
invoke: pi-desktop/<domain>/<action>
event: pi-desktop/<domain>/event/<name>
```

示例：

- `pi-desktop/agent/prompt`
- `pi-desktop/agent/abort`
- `pi-desktop/agent/event/message`
- `pi-desktop/session/list`
- `pi-desktop/project/open`

## 4. 通用响应包

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
 images?: Array<{
 mimeType: string;
 dataBase64: string;
 }>;
};

type AgentPromptResponse = {
 accepted: boolean;
 turnId: string;
};
```

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

main → renderer 推送：

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

> 这里是 **UI 规范化事件**，不是 pi 原始事件的透传。 
> `packages/agent-runtime` 负责把 pi 事件映射到该模型。

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

最小接口：

- `session/list`
- `session/create`
- `session/get`
- `session/delete`
- `session/rename`

## 8. Settings / Secrets API

### settings
可回传 UI 的非敏感配置：

- provider 列表（不含 secret 明文）
- 默认模型
- 权限策略开关
- UI 偏好

### secrets
- `secrets/set(providerId, apiKey)`
- `secrets/delete(providerId)`
- `secrets/has(providerId) -> boolean`

禁止：
- 把完整 API Key 写入普通日志
- 在 renderer 长期持有 API Key 明文

## 9. Project API

- `project/open()`：系统目录选择器
- `project/get()`：当前工作区
- `project/set(path)`：设置工作区
- `project/clear()`

返回：

```ts
type ProjectWorkspace = {
 path: string;
 name: string;
};
```

## 10. Tool Permission API

当工具需要确认：

1. main 发 `tool_permission_request`
2. UI 展示确认卡
3. UI 调 `tool/resolvePermission`

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

## 11. 版本兼容

- IPC contract 版本字段：`protocolVersion: 1`
- 破坏性变更必须升版本并写 ADR
- renderer 与 main 启动时校验版本，不匹配则提示升级/重装

## 12. Plugin API（宿主 UI 侧）

最小接口：

- `plugin/list`
- `plugin/loadDev(path)`
- `plugin/installFromPath(path)`
- `plugin/enable(id)`
- `plugin/disable(id)`
- `plugin/uninstall(id)`
- `plugin/getPermissions(id)`
- `plugin/setPermission(id, permission, allowed)`（可选细粒度）

返回摘要：

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

命令来源：
- 内置命令
- 插件 contributes.commands

## 14. 错误码（初稿）

| code | 含义 |
|---|---|
| `AGENT_BUSY` | 当前会话已有运行中 turn |
| `AGENT_NOT_FOUND` | session 不存在 |
| `MODEL_NOT_CONFIGURED` | 无可用模型 |
| `SECRET_MISSING` | 缺 API Key |
| `TOOL_DENIED` | 权限拒绝 |
| `TOOL_TIMEOUT` | 工具超时 |
| `WORKSPACE_REQUIRED` | 需要项目目录 |
| `PATH_OUTSIDE_WORKSPACE` | 路径越界 |
| `INTERNAL` | 未分类内部错误 |
