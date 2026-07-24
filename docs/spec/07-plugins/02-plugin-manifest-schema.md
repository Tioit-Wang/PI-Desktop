# 15. Plugin Manifest Schema

## 1. 目的

冻结插件清单字段，保证：

- 宿主可校验
- 开发者可依赖
- 后续版本可迁移

Schema Version：`1`

## 2. 根对象

```ts
type PluginManifestV1 = {
 schemaVersion: 1;
 id: string; // ^[a-z0-9]+(\.[a-z0-9_-]+)+$
 name: string;
 version: string; // semver
 description?: string;
 author?: string | { name: string; url?: string; email?: string };
 homepage?: string;
 repository?: string;
 icon?: string; // relative path
 main?: string; // plugin runtime entry
 ui?: PluginUiConfig;
 contributes?: PluginContributes;
 permissions?: PluginPermission[];
 engines?: {
 piDesktop?: string; // semver range
 };
 entrypoints?: {
 onInstall?: string;
 onLoad?: string;
 onEnable?: string;
 onDisable?: string;
 onUnload?: string;
 onUninstall?: string;
 };
 activationEvents?: string[]; // e.g. onCommand:xxx / onStartup
};
```

## 3. UI 配置

```ts
type PluginUiConfig = {
 panel?: string; // html entry
 width?: number;
 height?: number;
 resizable?: boolean;
 title?: string;
};
```

## 4. contributes

```ts
type PluginContributes = {
 commands?: PluginCommandContrib[];
 agentTools?: PluginAgentToolContrib[];
 skills?: string[]; // relative paths
 settings?: PluginSettingContrib[];
 themes?: PluginThemeContrib[];
};

type PluginCommandContrib = {
 id: string; // plugin-local or fully-qualified
 title: string;
 keywords?: string[];
 category?: string;
 icon?: string;
 requires?: PluginPermission[]; // extra per-command perms
};

type PluginAgentToolContrib = {
 name: string; // tool name exposed to agent
 description: string;
 risk: "low" | "medium" | "high";
 schema: Record<string, unknown>; // JSON schema object
 timeoutMs?: number;
 permissions?: PluginPermission[];
};

type PluginSettingContrib = {
 key: string;
 title: string;
 description?: string;
 type: "string" | "number" | "boolean" | "select" | "json";
 default?: unknown;
 enum?: Array<{ label: string; value: string | number | boolean }>;
 secret?: boolean;
};

type PluginThemeContrib = {
 id: string;
 label: string;
 path: string; // json/css tokens
};
```

## 5. permissions 枚举

```ts
type PluginPermission =
 | "ui.panel"
 | "clipboard.read"
 | "clipboard.write"
 | "notify"
 | "fs.read.workspace"
 | "fs.write.workspace"
 | "agent.tool.register"
 | "agent.prompt.inject"
 | "net.fetch"
 | "shell.openExternal";
```

未知 permission = 校验失败。

## 6. activationEvents（可选）

示例：

- `onStartup`
- `onCommand:demo.hello.say`
- `onAgentMode`
- `onWorkspaceOpen`

MVP 可只实现：
- `onStartup`
- `onCommand:*`

## 7. 校验规则

1. `schemaVersion` 必须为 `1`
2. `id`/`name`/`version` 必填
3. 有 `ui.panel` 时默认需要 `ui.panel` 权限（可隐式补齐或强制声明，实现时二选一并固定）
4. 有 `agentTools` 时必须声明 `agent.tool.register`
5. 路径字段不得使用绝对路径或 `..`
6. `main` / `ui.panel` / skills 路径必须存在
7. tool `name` 仅允许 `[a-zA-Z][a-zA-Z0-9_]*`

## 8. 示例：最小插件

```json
{
 "schemaVersion": 1,
 "id": "demo.hello",
 "name": "Hello",
 "version": "0.1.0",
 "main": "main.js",
 "ui": {
 "panel": "renderer/index.html"
 },
 "contributes": {
 "commands": [
 {
 "id": "hello.open",
 "title": "Open Hello Panel",
 "keywords": ["hello"]
 }
 ]
 },
 "permissions": ["ui.panel"]
}
```

## 9. 示例：Agent Tool 插件

```json
{
 "schemaVersion": 1,
 "id": "demo.echo-tool",
 "name": "Echo Tool",
 "version": "0.1.0",
 "main": "main.js",
 "contributes": {
 "agentTools": [
 {
 "name": "echo_text",
 "description": "Echo a text value",
 "risk": "low",
 "schema": {
 "type": "object",
 "properties": {
 "text": { "type": "string" }
 },
 "required": ["text"]
 }
 }
 ]
 },
 "permissions": ["agent.tool.register"]
}
```

## 10. 兼容策略

- 未来 `schemaVersion: 2` 需迁移器
- 宿主应拒绝过高主版本
- 对未知可选字段可忽略，对未知必需权限必须失败
