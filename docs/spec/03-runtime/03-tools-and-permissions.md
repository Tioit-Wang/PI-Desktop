# 03. Tools and Permissions

> Decisions applied: D003, D004, D005, D006, D013

## 0. Frozen policy summary

| Topic | Decision |
|---|---|
| Default mode | Agent |
| Chat tools | Read / Glob / Grep only |
| Agent tools | Read / Glob / Grep / Write / Edit / Bash |
| Permission timeout | 120s → deny |
| allow-session scope | toolName |
| Bash style (M3) | non-interactive (no PTY) |

# 07. Tools and Permissions

## 1. 目标

让 agent 能做事，但默认不失控。

## 2. MVP 内置工具

| Tool | 风险 | 说明 |
|---|---|---|
| `Read` | low | 读取工作区内文件 |
| `Glob` | low | 按模式列文件 |
| `Grep` | low | 内容搜索 |
| `Write` | high | 新建/覆盖文件 |
| `Edit` | high | 修改文件 |
| `Bash` | high | 执行命令 |

> 名称可在实现时微调，但语义保持一致。

## 3. 工具通用约束

每个工具都必须具备：

1. JSON schema / typebox 参数定义
2. timeout
3. 工作区路径校验
4. 输出截断策略
5. trace id
6. 结构化结果

## 4. 路径规则

- 所有文件路径默认相对 `workspaceRoot`
- 规范化后必须仍位于 workspace 内
- 禁止 `..` 逃逸
- 符号链接若逃出 workspace，则拒绝
- 未设置 workspace 时，高风险工具不可用

## 5. Bash 规则

MVP 基线：

- 必须有 workspace
- 默认 cwd = workspaceRoot
- 默认需要确认
- 设置 timeout（如 60s，可配）
- 捕获 stdout/stderr
- 大输出截断
- 不提供交互式 TTY（MVP）

禁止清单（初稿，可配置加强）：

- 直接读写 workspace 外敏感路径
- 无确认的破坏性操作策略由权限层控制

## 6. 权限模型

### 风险等级

| risk | 示例 | 默认策略 |
|---|---|---|
| low | Read/Glob/Grep | 自动允许 |
| medium | 低危网络/元数据 | 确认或策略允许 |
| high | Write/Edit/Bash | 默认确认 |

### 决策类型

- `allow-once`
- `allow-session`
- `deny`

后续可加：
- `allow-always-for-tool`
- `allow-always-for-command-pattern`

## 7. 权限流程

```text
tool call
 → policy.evaluate()
 → allow? 执行
 → need confirm? 推 UI
 → deny? 返回 tool error result
```

权限确认超时：
- 默认 deny 或 pending cancel（实现时定，需一致）

## 8. 工具结果对模型可见性

- 成功结果：给模型
- 失败结果：给模型（带错误信息）
- 用户拒绝：给模型明确 “user denied permission”
- 敏感信息：脱敏后再入库/展示

## 9. 审计

每次工具调用记录：

- sessionId
- turnId
- toolCallId
- toolName
- args hash / preview
- decision
- duration
- success / error code

MVP 可先写 SQLite 或日志文件。

## 10. Mode matrix (Chat vs Agent)

| Mode | Read/Glob/Grep | Write/Edit | Bash |
|---|---|---|---|
| Chat | allow | deny | deny |
| Agent | allow | confirm | confirm |

### Notes
- Chat mode hard-denies high-risk tools before permission UI
- Agent mode uses permission cards for Write/Edit/Bash
- allow-session is remembered per toolName for the active session only

## 10b. Legacy section title retained below


| 模式 | 读工具 | 写工具 | Bash |
|---|---|---|---|
| Chat | 默认允许 | 默认禁用或强确认 | 默认禁用 |
| Agent | 允许 | 确认后允许 | 确认后允许 |

## 11. 插件工具

插件可通过 `agentTools` 贡献工具：

1. manifest 声明
2. 用户授权 `agent.tool.register`
3. PluginManager 注册到 ToolHost
4. 执行时走统一权限/审计/超时包装

命名建议：
- 内部全名：`plugin.<pluginId>.<toolName>`
- 对模型暴露名实现时固定一种策略，避免冲突

## 12. 后续扩展

- MCP tools
- 工具分组开关
- 命令白名单 / 黑名单
- dry-run 模式
- 补丁预览后应用
