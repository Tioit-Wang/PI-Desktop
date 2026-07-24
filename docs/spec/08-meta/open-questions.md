# Open Questions

> 这些问题不阻塞 Baseline Spec 冻结，但会在实现前尽量收敛。

## 产品

1. 产品最终 appId / bundleId 是否固定为 `com.pi.desktop`？
2. 默认模式是 Chat 还是 Agent？
3. 是否要在 MVP 兼容读取用户已有 `~/.pi` 配置？

## 技术

1. SQLite 选型：`better-sqlite3` 还是 `@earendil-works/pi-storage-sqlite-node`？
2. 校验库：zod 还是 typebox（pi 生态更近 typebox）？
3. 是否在 M3 就引入 `node-pty`，还是 Bash 仅非交互执行？
4. agent 并发：多 session 并行时最大数量如何限制？

## 权限

1. 权限确认超时默认 deny 还是 cancel turn？
2. `allow-session` 的粒度按 tool 还是按 tool+路径模式？
3. Chat 模式是否彻底禁止 Bash，还是强确认可用？

## 发布

1. 首个可分发版本是否只做 macOS arm64？
2. 自动更新是否进入 M4，还是 post-MVP？

## 决策规则

- 影响架构边界的问题：必须写 ADR
- 只影响实现细节的问题：可在实现时定，并回写 spec


## 插件系统

1. 插件 runtime 首期用独立进程，还是先 main 内受限执行？
2. 插件 tool 对模型暴露名是否强制 `pluginId_toolName` 前缀？
3. 命令面板快捷键默认用什么？
4. 插件设置里 secret 字段是否允许（默认建议否）？
5. 是否允许插件读取当前会话摘要（默认否）？


## 市场与分发

1. 官方市场域名与 provider id 是什么？
2. 是否允许用户默认添加第三方源？
3. `.piplug` 是否同时兼容裸 `.zip` 安装？
4. 自动更新默认策略是否永远保持关闭？
5. 企业私有源认证用 token header 还是 mTLS？


## 生命周期细节

1. enable 后 load 失败，是否自动回退 disabled？
2. 卸载时默认是否删除插件 data？
3. 热重载是否允许在 agent turn 进行中执行？


## Globalization

1. Which i18n library exactly (i18next vs lingui vs custom)?
2. When should zh-CN locale pack be introduced?
3. Should plugin marketplace listings require English descriptions?

## Rust host core

1. Electron ↔ Rust transport for MVP: stdio JSON-RPC, protobuf, or neon/napi addon?
2. Should session SQLite be owned by Rust only, or shared with Node adapters?
3. How do we package Node pi sidecar runtime with Electron on each OS?
4. What is the protocol version handshake format across Electron/Rust/Node?
