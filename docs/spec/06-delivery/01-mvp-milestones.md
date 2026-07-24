# 01. MVP Milestones

## Version slices

### M0 — Spec Freeze
- [x] Product positioning
- [x] Electron route
- [x] Rust host core route
- [x] English-first globalization route
- [x] Plugin system architecture
- [x] Private GitHub repository initialized

### M1 — App Skeleton
Goal: bootable desktop shell with dual backend skeletons.

Deliverables:
- pnpm monorepo
- Electron app (main/preload/renderer)
- English locale source pack
- Rust `host-core` crate skeleton + healthcheck
- Node agent-runtime package skeleton
- IPC healthcheck end-to-end
- reserved PluginManager/CommandPalette interfaces

Exit criteria:
- `pnpm dev` opens window in English
- Electron can call Rust host healthcheck
- protocol/version handshake visible in logs

### M2 — Pi Chat Runtime
Goal: real streaming chat.

Deliverables:
- pi runtime integration
- provider/model settings
- secret storage
- prompt/abort
- stream event UI
- session persistence baseline

Exit criteria:
- configure key and chat successfully
- streamed tokens visible
- history survives restart

### M3 — Workspace Tools
Goal: controlled local agency.

Deliverables:
- project open
- Read/Glob/Grep/Write/Edit/Bash via Rust host
- permission cards
- tool traces

Exit criteria:
- complete one approved local modification on a real project
- denied permission path is correct

### M4 — Plugin Foundation
Goal: user-installable local extension system.

Deliverables:
- PluginManager
- manifest validation
- local/dev plugin load
- command palette plugin commands
- sample plugin e2e
- permission declaration UI

Exit criteria:
- load example plugin
- run plugin command
- register low-risk agent tool
- disable removes contributions

### M5 — Desktop Hardening
Goal: daily-usable package.

Deliverables:
- packaging (**macOS arm64 only** for first release)
- settings polish
- logging/error boundaries
- session management basics
- isolation verification

### M6+ (Post-MVP)
- Skills depth
- MCP
- `.piplug` packaging UX polish
- marketplace preview
- Windows/Linux hardening
- additional locales (e.g. zh-CN)

## Release constraint

First distributable release target: **macOS arm64 only** (D010).

## Rough effort (solo)

| Milestone | Estimate |
|---|---|
| M0 | done |
| M1 | 1-2 days |
| M2 | 2-4 days |
| M3 | 3-5 days |
| M4 | 3-5 days |
| M5 | 2-4 days |
