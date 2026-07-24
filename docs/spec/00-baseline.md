# PI-Desktop Baseline Freeze

- Baseline Version: `0.3.0`
- Date: `2026-07-25`
- Status: `Frozen for scaffolding`
- Language policy: **English-first**
- Backend policy: **Rust host core + pi agent sidecar**

## Frozen Decisions

1. Product name: **PI-Desktop**
2. Desktop shell: **Electron**
3. UI: **React + TypeScript + Vite + Tailwind**
4. UI language default: **English**
5. Docs / issues / commits language: **English primary**
6. Agent engine: **pi (`pi-ai` + `pi-agent-core`)**
7. Backend host core: **Rust**
8. Agent loop location: **Node/TypeScript pi sidecar** (not renderer)
9. Electron main role: **thin orchestrator**
10. Bridge: **preload IPC only for renderer**
11. Host services transport: **Electron main ↔ Rust core local RPC**
12. Storage: **local SQLite + secure secret storage**
13. MVP domain: **local coding agent**
14. MVP tools: **Read / Glob / Grep / Write / Edit / Bash**
15. Not in MVP: **Gateway / remote WebUI control**
16. Extension model: **user-installable plugin system**
17. Plugin first phase: **commands / panel / agentTools / skills**
18. Plugin market: **protocol defined, implementation postponed**
19. Plugin package format: **`.piplug` (zip)**
20. Plugin trust first step: **sha256 checksum; signature later**

## Source of Truth

- Spec index: `docs/spec/README.md`
- Navigation: `docs/spec/NAV.md`
- ADRs: `docs/adr/`
- Example plugin: `examples/plugins/hello`

## Next Action

Start **M1**:

1. pnpm monorepo + Electron app skeleton
2. Rust host core crate skeleton
3. i18n English source-of-truth setup
4. Reserve plugin interfaces
