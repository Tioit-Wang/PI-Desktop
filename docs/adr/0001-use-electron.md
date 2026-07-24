# ADR 0001: 使用 Electron 作为桌面壳

- 状态：Accepted
- 日期：2026-07-25

## 背景

PI-Desktop 需要桌面分发、本地权限控制、会话 UI 与系统集成能力。候选方案主要是 Electron 与 Tauri。

## 决策

采用 **Electron** 作为桌面壳。

## 理由

1. 与已调研的 ChatGPT Desktop / WorkBuddy 技术路径接近，便于借鉴工程经验
2. Node 生态与 pi 的 TypeScript runtime 更顺滑
3. 原生模块、调试链路、打包资料更成熟
4. 团队当前路线明确偏好 Electron

## 后果

### 正向
- 开发速度快
- agent runtime 可直接放 main/node 侧
- 后续集成 pty、sqlite、auto-update 更常规

### 负向
- 包体与内存相对 Tauri 更重
- 需要严格执行 Electron 安全基线

## 替代方案

- Tauri 2：更轻，但与当前路线不一致，已放弃作为 MVP 基线
