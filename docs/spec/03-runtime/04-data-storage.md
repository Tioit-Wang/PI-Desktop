# 08. Data Storage

## 0. Ownership decision

**Rust host-core owns SQLite exclusively (D002).**

- Node pi sidecar does not open the DB directly
- Electron main does not write DB files directly
- All session/settings/plugin registry writes go through host RPC

## 1. 目标

本地优先，重启可恢复，敏感数据隔离。

## 2. 存储分区

| 分区 | 内容 | 建议介质 |
|---|---|---|
| settings | 非敏感配置 | SQLite / JSON |
| secrets | API Key | OS safeStorage + 元数据索引 |
| sessions | 会话与消息 | SQLite |
| logs | 运行日志 | 文件 |
| cache | 模型目录缓存等 | 文件/SQLite |

## 3. 建议路径

```text
~/.pi-desktop/
 ├── settings.sqlite
 ├── sessions.sqlite
 ├── secrets.meta.json
 ├── secrets.bin # 或平台安全存储
 ├── logs/app.log
 └── cache/
```

具体文件名实现时可调整。

## 4. Session 数据模型（逻辑）

### sessions
- id
- title
- project_path
- model_id
- mode (`chat`|`agent`)
- created_at
- updated_at
- status

### messages
- id
- session_id
- role (`user`|`assistant`|`tool`|`system`)
- content_json
- created_at
- turn_id
- parent_id nullable

### tool_calls
- id
- message_id
- tool_name
- args_json
- result_json
- status
- started_at
- ended_at

### turn_runs
- id
- session_id
- status (`running`|`completed`|`aborted`|`error`)
- started_at
- ended_at
- error_code nullable

## 5. Settings 模型（逻辑）

- providers[]
- defaultProviderId
- defaultModelId
- permissionPolicy
- uiPreferences
- proxyConfig（后续）

provider 项不直接存 apiKey 明文，只存：

- hasSecret
- secretUpdatedAt

## 6. Secrets 规则

1. renderer 永不持久化 secret
2. main 使用 Electron `safeStorage`（可用时）
3. 无法安全存储时，明确降级策略并提示风险
4. 导出会话默认不含 secrets

## 7. 一致性

- 消息先写盘再确认 UI 最终态，或采用“运行中内存 + 终态落盘”二选一
- MVP 推荐：
 - user message 立即落盘
 - assistant/tool 在 end 事件时落盘
 - running 状态可有轻量快照

## 8. 迁移

- schema_version 表
- 启动时 migrate
- 破坏性迁移必须可备份

## 9. 备份与清理（后续）

- 一键导出 session
- 清理 cache
- 日志轮转

MVP 只需：
- 不丢会话
- 可删会话
