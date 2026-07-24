# 10. Security

## 1. 安全目标

1. 防止 renderer 获得无约束系统权限
2. 保护 API Key
3. 限制 agent 工具造成的破坏半径
4. 保证关键操作可审计

## 2. Electron 安全基线

必须：

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`（preload 设计允许时）
- 关闭远程模块
- 限制导航到非预期 URL
- preload 仅暴露白名单 API

## 3. 密钥安全

- 使用 `safeStorage` 加密存放
- UI 只显示“已配置/未配置”
- 日志禁止打印 secret
- 错误信息避免回显完整 key

## 4. 工作区沙箱

- 文件工具默认限制在 project root
- path normalize + root boundary check
- 拒绝越界符号链接目标（能检测时）

## 5. 命令执行安全

- Bash 默认确认
- timeout 强制存在
- 输出截断
- 记录完整命令审计信息
- 后续支持 allowlist/denylist

## 6. 供应链

- 锁定依赖版本策略（实现时定）
- 优先使用官方 pi 包
- 不在 MVP 动态执行远程脚本插件

## 7. 更新安全（后续）

- 签名发布
- 自动更新通道校验
- 不在 MVP 强依赖

## 8. 威胁模型（简版）

| 威胁 | 缓解 |
|---|---|
| 恶意网页内容进 renderer | 无 Node、限制导航、CSP 评估 |
| Prompt 诱导删库/泄密 | 权限确认、路径限制、密钥隔离 |
| 依赖投毒 | 锁版本、少依赖、审查原生模块 |
| 本地恶意扩展 | MVP 不引入任意扩展执行 |

## 9. 安全验收门槛

1. renderer 无法直接 require fs
2. 未确认不能执行 Write/Edit/Bash
3. workspace 外写文件失败
4. API Key 不以明文出现在会话导出默认选项中
5. IPC 非白名单 channel 不可用
