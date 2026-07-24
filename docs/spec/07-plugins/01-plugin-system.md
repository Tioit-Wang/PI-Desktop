# 14. Plugin System

## 1. 目标

让 PI-Desktop 具备类似 **** 的可扩展能力：

- 用户可安装 / 启用 / 禁用 / 卸载插件
- 开发者可自定义插件
- 插件能扩展命令、面板、工具、Agent 能力
- 平台保持安全边界，不把完整系统权限直接交给任意第三方代码

一句话：

> **PI-Desktop 是宿主，插件是能力包。**

## 2. Design goals

### 借鉴
- 插件目录化安装
- 清单文件声明能力
- 功能关键字 / 命令触发
- 独立插件管理页
- 开发者模式加载本地插件

### 差异（因为我们是 Agent 桌面）
- 插件不只是小工具面板，还可扩展：
 - Agent Tools
 - Skills
 - MCP bridge
 - 会话命令
 - 设置项
- 高风险能力必须走权限框架
- 插件默认不能直接拿到任意 Node/Electron 权限

## 3. 插件能做什么

### MVP-Plugin 范围（第一期插件系统）
1. **Command 插件**：注册命令面板动作
2. **Panel 插件**：打开插件 UI 面板（iframe / webview 沙箱页）
3. **AgentTool 插件**：向 agent 提供新工具
4. **Skill 插件**：提供可加载 skill 文档/流程
5. **Theme 插件（可选轻量）**：主题 token 覆盖

### 后续
- MCP Server 打包分发
- 后台常驻服务插件
- 市场安装 / 自动更新
- 插件间消息总线
- 计费/签名插件

## 4. 插件形态

每个插件是一个目录：

```text
my-plugin/
├── manifest.json # 必需
├── package.json # 可选（若含构建产物/依赖元数据）
├── main.js # 插件主进程扩展入口（受限 API）
├── preload.js # 可选，插件面板 bridge
├── renderer/ # 插件 UI（静态资源）
│ ├── index.html
│ └── assets/
├── skills/ # 可选
├── tools/ # 可选（声明式 tool schema）
├── icon.png
└── README.md
```

### 安装位置

```text
~/.pi-desktop/plugins/
 ├── installed/
 │ └── <plugin-id>/
 ├── disabled/
 └── cache/
```

开发模式可直接加载本地路径，不复制到 installed。

## 5. manifest.json（核心契约）

```json
{
 "id": "demo.hello",
 "name": "Hello Plugin",
 "version": "0.1.0",
 "description": "示例插件",
 "author": "you",
 "main": "main.js",
 "ui": {
 "panel": "renderer/index.html",
 "width": 480,
 "height": 360
 },
 "contributes": {
 "commands": [
 {
 "id": "hello.say",
 "title": "Hello: Say",
 "keywords": ["hello", "你好"],
 "category": "Demo"
 }
 ],
 "agentTools": [
 {
 "name": "hello_echo",
 "description": "Echo text back",
 "risk": "low",
 "schema": {
 "type": "object",
 "properties": {
 "text": { "type": "string" }
 },
 "required": ["text"]
 }
 }
 ],
 "skills": ["./skills/hello.md"],
 "settings": [
 {
 "key": "greeting",
 "type": "string",
 "default": "Hello",
 "title": "Greeting"
 }
 ]
 },
 "permissions": [
 "clipboard.read",
 "clipboard.write",
 "notify",
 "fs.read.workspace",
 "agent.tool.register"
 ],
 "engines": {
 "piDesktop": ">=0.1.0"
 },
 "entrypoints": {
 "onLoad": "main.js#onLoad",
 "onUnload": "main.js#onUnload"
 }
}
```

### 字段约束
- `id` 全局唯一，建议反域命名
- `version` 遵循 semver
- `permissions` 必须显式声明
- 未声明权限默认无
- manifest 校验失败则拒绝加载

## 6. 插件运行模型

采用 **三层隔离**：

```text
Host Main (PI-Desktop)
 ├─ PluginManager
 ├─ PluginPermissionGateway
 ├─ Plugin Sandbox / Worker
 └─ Plugin Panel (Renderer iframe/webview)
```

### 6.1 Host Main
- 安装/卸载/启用/禁用
- 校验 manifest
- 授权管理
- 路由命令与 tool 调用

### 6.2 Plugin Runtime（受限）
插件逻辑运行在受限环境，不直接等于 Electron main 全权。

MVP 建议：
- 优先 **UtilityProcess / Child Process** 跑插件 main
- 通过 JSON-RPC / IPC 调 Host API

若首期实现成本过高，可过渡：
- main 内 vm 隔离 + 严格 API 代理 
但目标架构仍应走向独立进程。

### 6.3 Plugin Panel UI
- 用 `iframe` 或 `webview` 加载插件页面
- 仅能调用插件 preload 暴露的安全 API
- 默认无法访问宿主 DOM / 宿主 store

## 7. Host API（插件可调用）

命名空间：`pi.plugin.*`

### 基础
- `pi.app.getVersion()`
- `pi.plugin.getManifest()`
- `pi.plugin.getSettings()`
- `pi.plugin.setSettings(partial)`
- `pi.commands.register(command)`
- `pi.ui.openPanel(options?)`
- `pi.ui.showToast(message)`
- `pi.ui.notify(title, body)`

### 工作区（需权限）
- `pi.workspace.get()`
- `pi.fs.readText(path)`
- `pi.fs.writeText(path, content)` // high risk
- `pi.fs.glob(pattern)`

### Agent（需权限）
- `pi.agent.registerTool(tool)`
- `pi.agent.unregisterTool(name)`
- `pi.agent.invokeSkill(id)`
- `pi.agent.appendSystemHint(text)`（受控）

### 剪贴板/系统（需权限）
- `pi.clipboard.readText()`
- `pi.clipboard.writeText(text)`
- `pi.shell.openExternal(url)` // 默认确认

### 明确不直接提供
- 任意 `child_process`
- 任意绝对路径 fs
- 任意 Electron 原生模块
- 任意动态 require 宿主内部对象

## 8. 权限模型

### 权限清单（初稿）

| permission | 风险 | 说明 |
|---|---|---|
| `ui.panel` | low | 显示面板 |
| `clipboard.read` | medium | 读剪贴板 |
| `clipboard.write` | medium | 写剪贴板 |
| `notify` | low | 系统通知 |
| `fs.read.workspace` | medium | 读工作区 |
| `fs.write.workspace` | high | 写工作区 |
| `agent.tool.register` | high | 注册 agent 工具 |
| `agent.prompt.inject` | high | 注入提示词 |
| `net.fetch` | high | 网络请求 |
| `shell.openExternal` | medium | 打开外链 |

### 授权时机
1. 安装时展示权限列表
2. 首次使用高风险 API 可二次确认
3. 用户可在插件管理页撤销权限（撤销后需禁用对应能力）

## 9. Command palette

全局命令面板支持：

- 搜索插件命令
- 关键词触发
- 最近使用
- 按 category 分组

交互流：

```text
用户打开命令面板
 → 输入关键字
 → 命中 plugin command
 → 执行 command handler
 → 打开 panel 或触发 agent/tool
```

快捷键（建议）：
- macOS：`Command+Shift+P` 或自定义
- support quick launcher invocation later

## 10. AgentTool 插件机制

插件注册 tool 后：

1. PluginManager 校验 schema 与权限
2. ToolHost 包装 tool
3. 每次调用先过权限与审计
4. 真正执行落在插件 runtime
5. 结果规范化后返回 agent

包装层必须补：
- timeout
- 参数校验
- 错误标准化
- 审计日志
- 可禁用开关

## 11. 插件生命周期

```text
discover → validate → install → enable → load → running
 ↘ disable → unload
 ↘ uninstall → purge
```

钩子：
- `onInstall`
- `onLoad`
- `onEnable`
- `onDisable`
- `onUnload`
- `onUninstall`

失败策略：
- load 失败：标记 error，不影响宿主启动
- tool 执行失败：返回 tool error，不崩主进程

## 12. 插件管理 UI

设置页新增 **Plugins**：

功能：
- 本地安装（选目录 / zip）
- 开发者加载（路径）
- 启用/禁用
- 卸载
- 查看权限
- 查看日志
- 打开插件目录

状态标识：
- enabled
- disabled
- error
- dev-loaded

## 13. 开发者体验

提供：

1. 插件模板：`npm create pi-desktop-plugin`
2. manifest schema 校验器
3. 开发者热加载（watch 目录）
4. 示例插件：
 - Hello Panel
 - Workspace Greeter Tool
 - Clipboard Note

本地开发流：

```bash
# 开发插件
cd plugins/hello
pnpm dev

# 在 PI-Desktop 中
Plugins → Load Development Plugin → 选择目录
```

## 14. 与 pi 生态的关系

| 生态对象 | 关系 |
|---|---|
| pi Skills | 可被 skill 插件分发/管理 |
| pi Extensions | 不直接等同；需适配层 |
| MCP | 后续可作为特殊插件类型 `type: mcp` |
| Agent Tools | 插件最重要扩展面之一 |

原则：
- 不排斥 pi 原生能力
- 但用户侧统一叫 “插件”

## 15. 安全底线（不可破）

1. 插件默认无权限
2. 插件不能直接访问宿主 renderer 状态
3. 插件不能默认读写工作区外文件
4. 插件网络能力默认关闭
5. 插件更新/安装需完整性校验（后续签名）
6. 宿主核心进程不执行插件提供的任意 Electron main 代码注入

## 16. 分阶段落地

### P0（先设计，可与 M2/M3 并行准备）
- manifest 规范
- PluginManager 骨架
- 本地加载 / 启用禁用
- 命令注册
- 示例插件 1 个

### P1
- 插件 Panel UI
- 权限授予 UX
- AgentTool 注册与调用
- 插件设置存储

### P2
- zip 安装
- 插件日志中心
- 开发者热重载
- 更多官方示例

### P3
- 插件市场
- 签名与自动更新
- MCP 插件类型
- 后台服务插件

## 17. MVP 产品策略调整

原 MVP 可先不开放“完整插件市场”，但应预留：

- 插件目录
- manifest
- PluginManager 接口
- 至少一个内置/示例插件通路

即：

> **先有插件架构，再有插件生态。**

## 18. 验收（插件系统最小可用）

1. 用户可从本地目录加载插件
2. 插件命令出现在命令面板
3. 插件可打开自己的面板页
4. 插件可注册一个 low-risk agent tool 并成功调用
5. 禁用插件后命令与 tool 立即失效
6. 插件崩溃不导致宿主退出

## 19. 示例

仓库内示例插件：

- `examples/plugins/hello`
