# 25. Plugin IPC & Host Services

## 1. 目标

把插件相关宿主服务与 UI IPC 补全，保证实现时不靠临时约定。

## 2. 主进程服务

```text
PluginManager
 ├─ PluginRegistryStore
 ├─ ManifestValidator
 ├─ PackageInstaller
 ├─ PermissionGateway
 ├─ ContributionRegistry
 │ ├─ CommandRegistry
 │ ├─ AgentToolRegistry
 │ └─ SkillRegistry
 ├─ PluginRuntimeBroker
 ├─ PluginPanelHostService
 └─ MarketClient
```

## 3. UI IPC（补充）

### plugin domain
- `plugin/list`
- `plugin/detail`
- `plugin/loadDev`
- `plugin/installFromPath`
- `plugin/installFromPackage`
- `plugin/enable`
- `plugin/disable`
- `plugin/uninstall`
- `plugin/reload`
- `plugin/getLogs`
- `plugin/getPermissions`
- `plugin/grantPermissions`
- `plugin/revokePermissions`
- `plugin/openDataDir`
- `plugin/openInstallDir`

### commandPalette domain
- `commandPalette/search`
- `commandPalette/execute`
- `commandPalette/listRecent`

### market domain（后置实现，先定协议）
- `market/search`
- `market/getDetail`
- `market/install`
- `market/checkUpdates`
- `market/listProviders`

## 4. 事件（main → renderer）

- `plugin/event/changed`（installed/enabled 变更）
- `plugin/event/loadError`
- `plugin/event/permissionRequired`
- `market/event/updateAvailable`

## 5. ContributionRegistry 行为

### 注册
- key 必须唯一
- 插件命令统一前缀：`plugin.<pluginId>.<commandId>`
- 插件 tool 统一前缀策略：`plugin_<pluginIdSafe>_<toolName>`（实现固定）

### 查询
- 命令面板只查 enabled + loaded 成功的贡献点
- Agent 只看到已注册 tools

### 注销
- disable/unload/uninstall 时全量移除

## 6. RuntimeBroker 调用链

插件 API 调用：

```text
plugin runtime
 → RPC to PluginRuntimeBroker
 → PermissionGateway.check
 → Host service execute
 → audit log
 → response
```

## 7. PanelHost 交互

- 打开 panel 时创建隔离视图
- 传入 pluginId / theme tokens
- 关闭时销毁视图与消息订阅

## 8. 失败隔离

- 插件 API 超时：返回 TIMEOUT
- runtime 崩溃：标记 load_error，清理贡献点
- panel 崩溃：只关 panel，不卸插件（可提示重载）

## 9. 验收

1. 插件列表 IPC 可用
2. 命令面板 IPC 可执行插件命令
3. 启停触发贡献点注册注销
4. 市场 IPC 在 mock provider 下可跑通（后置里程碑）
