# ADR 0002: 使用 pi Agent Harness 作为内核

- 状态：Accepted
- 日期：2026-07-25

## 背景

需要一个可扩展的多模型 agent loop，而不是从零实现 tool calling、流式事件与 provider 适配。

## 决策

以以下包作为内核：

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`

后续可选用：

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-storage-sqlite-node`

## 理由

1. 统一 LLM provider 接口
2. agent event 模型清晰，适合桌面 UI
3. 具备 tool calling / session / skills 生态延展能力
4. LiveAgent 等项目已验证其可作为桌面产品内核

## 后果

### 正向
- 避免自研 agent 框架
- 可跟上游能力演进

### 负向
- 需要适配 pi 的事件与版本约束（Node >= 22.19）
- 某些桌面产品需求要在上层自行补齐（权限 UX、会话产品模型）

## 替代方案

- 自研 agent loop：成本高，否
- 直接以其他 coding agent 为内核：与“基于 pi”目标不符
