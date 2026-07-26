# PI-Desktop Baseline Freeze

- Baseline Version: `0.4.4`
- Date: `2026-07-26`
- Status: `Frozen for implementation details (provider + runtime safety + M5 hardening + settings IA + composer chrome)`
- Language policy: **English-first**
- Backend policy: **Rust host core + pi agent sidecar**

> Version history: `0.3.4` froze provider/runtime-safety decisions
> (D001–D033). `0.4.0` absorbs the Codex visual-parity decision series
> (D034+, gold source = decisions-log §D) and the M5 hardening decisions
> (D078–D083: signing lanes, brand icon, supervision, renderer sandbox,
> log channels, window state). `0.4.1` freezes the compact four-destination
> settings directory from D090 / ADR 0013. `0.4.2` replaces the frozen 720px
> settings content cap with the window-responsive D092 / ADR 0015 layout.
> `0.4.4` removes composer workspace context chrome through D095 / ADR 0017
> while preserving workspace selection, session binding, and tool scoping.

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
11. Host services transport: **Rust sidecar + stdio JSON-RPC (NDJSON)**
12. Storage ownership: **Rust host-core owns SQLite exclusively**
13. MVP domain: **local coding agent**
14. Default mode: **Agent**
15. Chat mode tools: **read-only** (`Read` / `Glob` / `Grep`)
16. MVP Agent tools: **Read / Glob / Grep / Write / Edit / Bash**
17. Permission timeout: **120s → deny**
18. Session grant scope: **by toolName**
19. `~/.pi` auto-import: **not in MVP**
20. Not in MVP: **Gateway / remote WebUI control**
21. Extension model: **user-installable plugin system**
22. Plugin first phase: **commands / panel / agentTools / skills**
23. Plugin runtime target: **separate process**; M4 may use host-managed sandboxed runtime
24. Plugin market: **protocol defined, implementation postponed**
25. Plugin package format: **`.piplug` (zip)**
26. Plugin trust first step: **sha256 checksum; signature later**
27. First release platform: **macOS arm64 only**
28. TS schema library: **typebox**
29. i18n library: **i18next**
30. Bash in M3: **non-interactive only**
31. Onboarding: **inline checklist**
32. Observability MVP: **local logs only**
33. Error model: **shared AppError code registry**
34. Provider coverage: **universal via pi-ai native + OpenAI-compatible + custom**
35. Model policy: **no closed allowlist; refreshable catalog + free-form model IDs**
36. Provider storage: **Rust SQLite configs + OS secret store references**
37. Secrets backend: **safeStorage primary + encrypted file fallback**
38. Workspace ignore: **denylist + defaults + `.pi-desktopignore`**
39. Tool result limits: **256KB / 4000 lines with truncation markers**
40. Settings directory: **General / Configuration / Import sessions / About**;
    plugin management remains the app shell's independent **Plugins** destination
41. Composer workspace context: **no project / Local / branch rail; project
    selection, session binding, branch detection, and tool scope remain intact**

## Source of Truth

- Spec index: `docs/spec/README.md`
- Navigation: `docs/spec/NAV.md`
- Decisions log: `docs/spec/08-meta/decisions-log.md`
- ADRs: `docs/adr/`
- Example plugin: `examples/plugins/hello`

## Next Action

Start **M1** against these frozen details:

1. pnpm monorepo + Electron app skeleton
2. Rust host-core crate + handshake/health RPC
3. English i18n source catalog
4. shared protocol types (typebox)
5. reserved plugin interfaces
6. provider settings contracts + model catalog scaffolding
