# 27. Plugin Roadmap

## 1. 总原则

```text
本地插件可用 → 开发者友好 → 市场分发 → 签名与自动更新
```

## 2. 路线图

### R1 — Foundation（跟 M4）
- manifest v1
- 本地目录加载
- enable/disable/uninstall
- command palette 接入
- hello 示例插件
- 权限声明展示

### R2 — Agent Extension
- agentTools 完整链路
- skills 贡献
- 插件设置页
- 插件日志面板
- 统一命名空间与审计

### R3 — DX & Packaging
- plugin-sdk
- 模板生成
- `pi-plugin check/pack`
- `.piplug` 安装
- dev hot reload

### R4 — Marketplace Read-only
- market provider 抽象
- 官方源浏览/搜索
- 下载 + checksum 安装
- updates 列表（手动更新）

### R5 — Trust & Auto Update
- 发布者认证
- 签名校验
- 权限 diff 升级
- 自动更新策略
- 恶意版本 yank 响应

### R6 — Advanced Ecosystem
- MCP 插件类型
- 后台服务插件
- 企业私有源
- 插件间消息总线
- 市场评论/质量分（可选）

## 3. 与产品里程碑映射

| 产品里程碑 | 插件目标 |
|---|---|
| M1 Skeleton | 预留 plugins 目录与接口空壳 |
| M2 Chat Runtime | 不阻断，可并行设计 |
| M3 Tools | ToolHost 预留贡献点接入 |
| M4 Plugin Foundation | R1 完成 |
| M5 Hardening | 插件隔离与稳定性 |
| Post-MVP | R2-R6 分期 |

## 4. 成功指标（生态）

1. 用户可在无官方新发版时，靠插件扩展工作流
2. 第三方能独立开发并本地安装插件
3. 插件故障不破坏主应用可用性
4. 安装任意插件前权限可见可拒

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 过早做市场导致核心不稳 | 市场后置，R1 先本地 |
| 插件安全事故 | 默认拒绝 + 审计 + 签名后续强制 |
| API 频繁破坏 | apiVersion / schemaVersion |
| 开发者门槛高 | 模板 + hello 示例 + SDK |
