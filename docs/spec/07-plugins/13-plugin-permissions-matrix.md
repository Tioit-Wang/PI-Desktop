# 26. Plugin Permissions Matrix

## 1. 目标

给出权限-能力-风险-默认策略对照表，供 UI 文案与校验复用。

## 2. 矩阵

| Permission | 风险 | 允许的 API / 能力 | 默认策略 | 备注 |
|---|---|---|---|---|
| `ui.panel` | low | 打开插件面板 | 安装时授予 | 几乎所有 UI 插件需要 |
| `clipboard.read` | medium | `clipboard.readText` | 首次确认 | 可能读取敏感信息 |
| `clipboard.write` | medium | `clipboard.writeText` | 首次确认 | 防污染剪贴板 |
| `notify` | low | `ui.notify` | 可默认授予 | 避免滥用刷通知 |
| `fs.read.workspace` | medium | `fs.readText` / `fs.glob` | 首次确认 | 仅工作区 |
| `fs.write.workspace` | high | `fs.writeText` | 每次或会话确认 | 高风险 |
| `agent.tool.register` | high | 注册 agent tool | 安装确认 | tool 执行另走审计 |
| `agent.prompt.inject` | high | 注入系统提示 | 默认拒绝/强确认 | 易造成行为劫持 |
| `net.fetch` | high | `net.fetch` | 默认拒绝 | 需展示目标域策略（后） |
| `shell.openExternal` | medium | `openExternal` | 首次确认 | 防钓鱼链接 |

## 3. 权限依赖

- 有 `ui.panel` 才可加载 panel 入口
- 有 `agent.tool.register` 才可贡献 agentTools
- 有 `fs.write.workspace` 时建议同时声明 `fs.read.workspace`

## 4. 权限展示文案（中文建议）

- `fs.read.workspace`：读取当前项目文件
- `fs.write.workspace`：修改当前项目文件
- `agent.tool.register`：向 AI Agent 提供可执行工具
- `net.fetch`：访问网络
- `shell.openExternal`：打开外部链接

## 5. 升级新增权限

升级时若出现新增权限：

1. 计算 diff
2. 强制用户确认
3. 未确认则取消升级或禁用新增能力（推荐取消升级）

## 6. 运行时检查伪代码

```ts
assertPermission(pluginId, perm) {
 if (!granted(pluginId, perm)) throw ERROR_PERMISSION_DENIED
}
```

所有 Host API 入口必须先 assert。

## 7. 验收

1. 未授权 API 调用失败
2. 权限文案在安装 UI 可见
3. 升级新增权限会提示
