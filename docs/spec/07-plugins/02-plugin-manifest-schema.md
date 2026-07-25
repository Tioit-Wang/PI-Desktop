# 02. Plugin Manifest Schema

## 1. Purpose

Freeze the plugin manifest fields to guarantee:

- The host can validate
- Developers can depend on it
- Future versions can migrate

Schema Version: `1`

## 2. Root object

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

## 3. UI config

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

## 5. permissions enum

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

Unknown permission = validation failure.

## 6. activationEvents (optional)

Examples:

- `onStartup`
- `onCommand:demo.hello.say`
- `onAgentMode`
- `onWorkspaceOpen`

MVP may implement only:
- `onStartup`
- `onCommand:*`

## 7. Validation rules

1. `schemaVersion` must be `1`
2. `id` / `name` / `version` are required
3. Whether a manifest that declares `ui.panel` needs the `ui.panel` permission implicitly (auto-filled) or by explicit declaration is an **open question** (tracked in [08-meta/open-questions.md](../08-meta/open-questions.md))
4. If `agentTools` are present, `agent.tool.register` must be declared
5. Path fields must not use absolute paths or `..`
6. `main` / `ui.panel` / skills paths must exist
7. tool `name` allows only `[a-zA-Z][a-zA-Z0-9_]*`

## 8. Example: minimal plugin

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

## 9. Example: Agent Tool plugin

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

## 10. Compatibility strategy

- A future `schemaVersion: 2` needs a migrator
- The host should reject a too-high major version
- Unknown optional fields may be ignored; unknown required permissions must fail
