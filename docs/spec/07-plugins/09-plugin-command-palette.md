# 22. Plugin Command Palette

## 1. 目标

提供user-installable快速命令入口，把内置能力与插件能力统一检索执行。

## 2. 入口

建议快捷键：

- macOS：`Command + Shift + P`
- Windows/Linux：`Ctrl + Shift + P`

也可设置：
- 自定义快捷键
- 启动器模式（后置）

## 3. 命令模型

```ts
type PaletteCommand = {
 id: string // e.g. builtin.session.new / plugin.demo.hello.open
 title: string
 keywords: string[]
 category?: string
 source: "builtin" | "plugin"
 pluginId?: string
 icon?: string
 enabled: boolean
 risk?: "low" | "medium" | "high"
}
```

## 4. 命令来源

1. 内置命令
 - 新建会话
 - 打开设置
 - 打开项目
 - 切换模式
2. 插件 `contributes.commands`
3. 后续：技能快捷入口 / 市场搜索入口

## 5. 检索规则

- 按 title / keywords / category / pluginName 匹配
- 支持前缀与包含匹配
- 中文关键词可用
- 结果排序：
 1. 最近使用
 2. 精确前缀
 3. 内置优先或用户权重（可配）
 4. 字母序

## 6. 执行流

```text
open palette
 → input query
 → select command
 → execute
 → builtin handler
 → or plugin command bridge
 → close palette / keep open(可选)
```

若命令需要 panel：
- 执行后打开 PluginPanelHost

若命令需要权限：
- 先走权限网关

## 7. UI 结构

```text
-------------------------------------------------
[ search input ]
-------------------------------------------------
Builtin
 New Chat
 Open Project
Demo
 Hello: Open Panel
Tools
 ...
-------------------------------------------------
Enter 执行 · Esc 关闭 · Tab 预览来源
-------------------------------------------------
```

每项显示：
- 标题
- 来源 badge（builtin/plugin）
- 快捷提示（可选）

## 8. 空状态 / 错误

- 无匹配：提示“无命令，尝试安装插件”
- 插件命令执行失败：toast + 日志
- 插件已禁用：命令不出现

## 9. 与 Agent 的关系

命令面板不是 chat composer 替代物。 
它负责“启动动作”，chat 负责“对话任务”。

可支持命令：
- “把当前选中命令结果发送到会话”（后置）

## 10. 验收

1. 快捷键唤起
2. 可搜索内置与插件命令
3. 执行插件命令成功
4. 禁用插件后命令消失
5. 最近使用排序生效
