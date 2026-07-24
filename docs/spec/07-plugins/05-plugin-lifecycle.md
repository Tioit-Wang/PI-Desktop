# 18. Plugin Lifecycle

## 1. 目标

定义插件从发现到卸载的完整状态机，保证：

- 行为可预测
- 失败可恢复
- 启停可审计
- 与命令面板 / AgentTool 注册一致

## 2. 状态机

```text
discovered
 → validated
 → installed
 → enabled
 → loaded
 → running
 → load_error
 → disabled
 → install_error
 → invalid
```

### 状态说明

| 状态 | 含义 |
|---|---|
| discovered | 扫描到插件目录或安装包 |
| validated | manifest / 文件完整性通过 |
| installed | 已写入 installed 目录并登记 |
| enabled | 用户启用，允许加载 |
| loaded | runtime 已加载，贡献点已注册 |
| running | 已有活跃 panel / 后台逻辑 |
| disabled | 已安装但用户关闭 |
| load_error | 启用后加载失败 |
| install_error | 安装失败 |
| invalid | 校验失败，不可用 |

## 3. 生命周期钩子

按顺序触发：

1. `onInstall`（仅安装成功后一次）
2. `onEnable`
3. `onLoad`
4. 运行期事件
5. `onUnload`
6. `onDisable`
7. `onUninstall`

### 调用约束
- 钩子必须可超时（默认 5s，可配）
- 钩子异常不得导致宿主崩溃
- `onLoad` 失败则进入 `load_error` 并自动回滚已注册贡献点

## 4. 启用 / 禁用语义

### enable
- 状态改为 enabled
- 尝试 load
- 成功：注册 commands / tools / skills
- 失败：保留 enabled=false 或 enabled=true + load_error（实现时固定一种；推荐 **失败则保持 disabled 并提示**）

### disable
- 注销 commands / tools
- 关闭 panel
- 调用 `onUnload` / `onDisable`
- 持久化为 disabled

## 5. 启动恢复

应用启动时：

1. 扫描 installed 插件
2. 读取启用状态
3. 仅加载 enabled 插件
4. 单个插件失败跳过，不影响其他插件与主应用

## 6. 开发者模式

`dev-loaded` 插件：

- 不复制到 installed
- 直接引用本地路径
- 可 watch 热重载
- 重载流程：`unload → validate → load`

热重载时：
- 尽量保留插件 settings
- 不保证 panel 内内存状态保留

## 7. 贡献点注册/注销事务

对每个插件 load 过程应近似事务：

```text
begin
 register commands
 register tools
 register skills
commit
```

中途失败：
```text
rollback all registrations from this plugin
```

避免“命令在、工具不在”的半加载状态。

## 8. 审计事件

至少记录：

- plugin.install
- plugin.uninstall
- plugin.enable
- plugin.disable
- plugin.load.success
- plugin.load.error
- plugin.unload
- plugin.crash

字段：
- pluginId
- version
- source (`installed`|`dev`|`marketplace`)
- ts
- errorCode?

## 9. 卸载策略

卸载前：
1. disable + unload
2. 调用 `onUninstall`
3. 删除 installed 文件
4. 清理插件私有 data（可询问用户是否保留）

默认建议：
- 卸载时清理 settings/data
- 提供“保留数据”高级选项（可后置）
