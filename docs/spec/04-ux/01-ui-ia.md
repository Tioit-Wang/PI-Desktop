# 09. UI Information Architecture

## 1. 目标

先做清晰、克制、开发者友好的工作台，不先追求视觉炫技。

## 2. 主界面布局

```text
+------------------+------------------------------+------------------+
| Sidebar | Main Chat | Context Panel |
| - New Chat | - message stream | - Project |
| - session list | - tool call cards | - status |
| - search (后) | - composer | - files (后) |
+------------------+------------------------------+------------------+
| Topbar: project / model / mode / abort / settings entry |
+--------------------------------------------------------------------+
```

## 3. 页面结构

### 3.1 Home / Workspace
默认进入主工作台，不必单独 dashboard。

### 3.2 Settings
独立路由/模态均可，MVP 用独立页面更清晰：

- Providers
- Models
- Permissions
- Appearance（可选）
- About

### 3.3 Session
每个 session 一页状态：
- messages
- running state
- permission prompts

## 4. 关键组件

| 组件 | 职责 |
|---|---|
| SessionList | 会话切换/新建/删除 |
| ChatTranscript | 消息与流式渲染 |
| ToolCallCard | 工具参数/结果/状态 |
| PermissionDialog | 高风险操作确认 |
| Composer | 输入、发送、附件预留 |
| ModelSelector | provider/model 切换 |
| ProjectPicker | 打开/显示工作区 |
| StatusBar | running/error/idle |

## 5. 消息展示规则

- user：纯文本为主
- assistant：markdown 流式渲染
- tool：独立卡片，不与正文混淆
- error：明确、可操作

工具卡片最小字段：
- tool name
- status（running/success/error/denied）
- args preview
- result preview
- duration

## 6. Composer 交互

- Enter 发送（可改）
- Shift+Enter 换行
- 运行中可 Abort
- 未配置模型时发送按钮禁用并提示
- 无 workspace 时高风险模式提示

## 7. 权限确认 UX

出现高风险工具时：

1. 聊天流内插入 permission card，或模态确认
2. 展示工具名、风险、关键参数
3. 操作：
 - 允许一次
 - 本会话允许
 - 拒绝
4. 决策后卡片转为终态

## 8. 空状态

- 无会话：引导新建
- 无 provider：引导去 Settings
- 无 project：提示打开文件夹（Agent 模式更明显）

## 9. 主题

MVP：
- 跟随系统 light/dark
- 先保证对比度与可读性

不做：
- 复杂主题市场

## 10. 可访问性与效率

- 关键操作键盘可达
- 长输出可折叠
- 工具结果默认截断，可展开

## 11. 明确延后的 UI

- 完整文件树编辑
- 分屏 diff editor
- 多终端矩阵
- 插件市场页
- 复杂仪表盘
