# 16. Plugin API

## 1. 设计原则

1. 小而稳
2. 权限驱动
3. 异步优先
4. 可审计
5. 不暴露宿主内部对象

## 2. 运行时注入对象

插件 runtime 中可访问全局：

```ts
declare const pi: PiPluginHostApi;
```

## 3. API 总表（MVP）

### app
```ts
pi.app.getVersion(): Promise<string>
pi.app.getLocale(): Promise<string>
```

### plugin
```ts
pi.plugin.getId(): string
pi.plugin.getManifest(): PluginManifestV1
pi.plugin.getSettings<T=Record<string, unknown>>(): Promise<T>
pi.plugin.setSettings(partial: Record<string, unknown>): Promise<void>
pi.plugin.getDataPath(): Promise<string> // 插件私有目录
```

### commands
```ts
pi.commands.register(def: {
 id: string
 title: string
 keywords?: string[]
 run: () => Promise<void> | void
}): Promise<void>

pi.commands.unregister(id: string): Promise<void>
```

### ui
```ts
pi.ui.openPanel(options?: { title?: string }): Promise<void>
pi.ui.closePanel(): Promise<void>
pi.ui.showToast(message: string, level?: "info"|"warn"|"error"): Promise<void>
pi.ui.notify(input: { title: string; body?: string }): Promise<void>
```

### workspace / fs
```ts
pi.workspace.get(): Promise<{ path: string; name: string } | null>

pi.fs.readText(pathFromWorkspaceRoot: string): Promise<string>
pi.fs.writeText(pathFromWorkspaceRoot: string, content: string): Promise<void>
pi.fs.glob(pattern: string): Promise<string[]>
```

### agent
```ts
pi.agent.registerTool(tool: {
 name: string
 description: string
 risk: "low"|"medium"|"high"
 schema: unknown
 execute: (args: unknown, ctx: ToolExecContext) => Promise<unknown>
}): Promise<void>

pi.agent.unregisterTool(name: string): Promise<void>
```

```ts
type ToolExecContext = {
 sessionId: string
 turnId?: string
 signal?: AbortSignal
 log: (msg: string) => void
}
```

### clipboard / shell
```ts
pi.clipboard.readText(): Promise<string>
pi.clipboard.writeText(text: string): Promise<void>
pi.shell.openExternal(url: string): Promise<void>
```

### net（默认高风险，可后置）
```ts
pi.net.fetch(input: {
 url: string
 method?: string
 headers?: Record<string, string>
 body?: string
 timeoutMs?: number
}): Promise<{ status: number; headers: Record<string, string>; bodyText: string }>
```

## 4. 错误模型

```ts
type PluginApiError = {
 code:
 | "PERMISSION_DENIED"
 | "NOT_FOUND"
 | "INVALID_ARGUMENT"
 | "TIMEOUT"
 | "UNSUPPORTED"
 | "INTERNAL"
 message: string
}
```

所有 API 失败抛出带 code 的 error。

## 5. 事件（宿主 -> 插件）

```ts
pi.events.on(event, handler)
pi.events.off(event, handler)
```

MVP 事件：
- `workspace:changed`
- `session:activated`
- `plugin:settingsChanged`
- `app:themeChanged`

## 6. 面板桥接 API

Panel UI 不直接拿完整 `pi`，而是：

```ts
window.pluginBridge.invoke(channel, payload?)
window.pluginBridge.on(event, handler)
```

由插件自己的 preload/main 转发到插件 runtime。

## 7. 调用审计

任何以下调用必须记审计日志：

- fs.writeText
- agent.registerTool 后的 execute
- net.fetch
- shell.openExternal
- clipboard.read/write（可采样）

日志字段：
- pluginId
- api
- ts
- sessionId?
- ok / errorCode

## 8. 版本策略

- API surface 以 `apiVersion` 管理
- MVP `apiVersion = 1`
- 废弃 API 至少保留一个主版本周期
